"""ผังข้อมูลหลังบ้าน: ไฟล์ไหนงานไหนเป็นคนเขียน และวิธีรวมไฟล์ก่อนส่งขึ้น branch ที่หลายงานใช้ร่วมกัน (gh-pages, hist)

ปัญหาเดิม: แต่ละงาน (update.yml รอบใหญ่, live.py ที่รันทั้งวัน) เอาโฟลเดอร์ data/ ในเครื่องตัวเองไป force-push ทับทั้ง branch
ใครส่งทีหลังก็เอาไฟล์เก่าที่ตัวเองไม่ได้แตะไปทับของใหม่ที่อีกงานเพิ่งส่ง

วิธีใหม่ (ทุกงานใช้ชุดเดียวกัน):
1. ตอนดึงข้อมูลจาก branch มาใช้ จด hash ของแต่ละไฟล์ไว้เป็น "ฐาน" (data/.sync/<branch>.json)
2. ตอนส่ง ดึงของล่าสุดบน branch มาก่อน แล้วเลือกทีละไฟล์:
   - ไฟล์ที่งานนี้แก้ (hash ต่างจากฐาน) และเป็นเจ้าของตามตาราง OWNERS → ใช้ของในเครื่อง
   - ถ้าบน branch ก็ถูกแก้ด้วย (อีกงานส่งมาหลังเราดึง) → ใช้ของที่เขียนทีหลัง (เวลาเขียนจริงจาก _files.json)
   - ไฟล์ที่งานนี้ไม่ได้แก้ หรือไม่ใช่เจ้าของ → ใช้ของบน branch และดึงมาแทนในเครื่องด้วย (รอบต่อไปจะได้ใช้ของใหม่)
3. ส่งด้วย --force-with-lease: ถ้าระหว่างนั้นมีงานอื่นส่งแทรก การส่งจะล้มแล้วรวมใหม่ (ไม่ทับกันเงียบ ๆ)
4. บน branch มี _files.json บอกว่าแต่ละไฟล์เขียนเมื่อไร โดยงานไหน

ใช้: python3 scripts/sd/datasync.py mark [branch...]          จดฐานหลังดึงข้อมูลจาก branch
     python3 scripts/sd/datasync.py pull <branch> --job J      ดึงไฟล์ที่งานอื่นส่งมาใหม่มาใช้ (ไม่ส่ง)
     python3 scripts/sd/datasync.py stage <branch> <out> --job J  รวมไฟล์ลง <out> เพื่อส่ง (sha ที่ใช้ lease อยู่ใน data/.sync/<branch>.lease)
     python3 scripts/sd/datasync.py done <branch>              ส่งสำเร็จแล้ว ย้ายฐานใหม่มาใช้
"""
import fnmatch, hashlib, json, os, shutil, subprocess, sys, tarfile, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SYNC = os.path.join(ROOT, "data", ".sync")
MANIFEST = "_files.json"

JOBS = {
    "update": "update.yml: รอบใหญ่หลังตลาดไทยปิด (HIST) และหลังตลาดสหรัฐฯ ปิด (FULL) + ตรวจหน้าเว็บ + ทีมงบ/โบรกเกอร์",
    "live": "live.yml → live.py: ราคาสด ข่าว ทีม Agent และ update.py รอบย่อยระหว่างวัน",
    "lab": "lab.yml: ทดสอบกลยุทธ์ย้อนหลัง เขียน lab.json ใน hist",
}
BOTH = ("update", "live")

# branch → (โฟลเดอร์ในเครื่อง, path ใน branch, รวมโฟลเดอร์ย่อยไหม, รูปแบบไฟล์)
SCOPES = {"gh-pages": ("data", "data", False, "*.json"), "hist": ("data/hist", "", True, "*")}

# ตารางเจ้าของไฟล์: (รูปแบบชื่อไฟล์, งานที่เขียนได้, คำอธิบาย) · เลือกแถวแรกที่ตรง · เพิ่มไฟล์ใหม่ต้องลงที่นี่และใน docs/data.md
OWNERS = {
    "gh-pages": [
        ("quotes.json", BOTH, "ราคาล่าสุดทุกหุ้น (live ทุก ~30 วินาทีช่วงตลาดเปิด)"),
        ("meta.json", BOTH, "เวลาอัปเดตแต่ละชุด ข้อผิดพลาด แถบดัชนี"),
        ("news.json", BOTH, "ข่าวผูกหุ้น"),
        ("archive_state.json", BOTH, "สถานะคลังข้อมูล branch archive"),
        ("brief.json", BOTH, "บทสรุปตลาด (live ตามเวลา, update เมื่อสั่งเขียนเอง)"),
        ("agents.json", ("live",), "งานของทีม Agent และผลตรวจข้อมูล"),
        ("ops.json", ("live",), "งานของทีมบอท (หน้าออฟฟิศ)"),
        ("prices.json", BOTH, "ราคาย้อนหลังหุ้นรายการหลัก"),
        ("universe.json", BOTH, "รายชื่อหุ้นทั้งตลาด (FULL ดึงใหม่ รอบอื่นแค่แก้รหัสซ้ำ)"),
        ("fund.json", BOTH, "อัตราส่วนพื้นฐาน"),
        ("macro.json", BOTH, "ปัจจัยมหภาค"),
        ("intra_recent.json", BOTH, "ราคารายชั่วโมงช่วงล่าสุด"),
        ("intra15_recent.json", BOTH, "ราคาราย 15 นาทีช่วงล่าสุด"),
        ("summary.json", BOTH, "คะแนน แผนซื้อขาย มูลค่า ของทุกหุ้น (summarize.js)"),
        ("uni.json", BOTH, "รายชื่อหุ้นแบบย่อสำหรับหน้าเว็บ (summarize.js)"),
        ("quality.json", BOTH, "คุณภาพสัญญาณ (summarize.js)"),
        ("rsq.json", BOTH, "ความแรงสัมพัทธ์ (summarize.js)"),
        ("calib.json", BOTH, "ค่าปรับเทียบคะแนนจากผลจริง (summarize.js)"),
        ("learn.json", BOTH, "ผลติดตามสัญญาณย้อนหลัง (summarize.js)"),
        ("health.json", BOTH, "ตรวจคุณภาพข้อมูล (หน้าสถานะข้อมูล)"),
        ("fin_audit.json", BOTH, "งบที่ตัวเลขผิดปกติ"),
        ("signals_round.json", BOTH, "เวลารอบคำนวณสัญญาณล่าสุด"),
        ("ux.json", ("update",), "ผลไล่ตรวจหน้าเว็บรายคืน (ux_check.js)"),
        ("sector_stats.json", ("update",), "สถิติรายกลุ่ม (peers.py)"),
        ("peer_index.json", ("update",), "ดัชนีเทียบคู่แข่ง (peers.py)"),
        ("brokers.json", ("update",), "มุมมองโบรกเกอร์ (brokers.py)"),
    ],
    "hist": [
        ("lab.json", ("lab",), "ผลทดสอบกลยุทธ์ (lab.js)"),
        ("_fundmem.json", ("update",), "ความจำงบรายไตรมาส (peers.py)"),
        ("peer/*", ("update",), "เทียบคู่แข่งรายตัว (peers.py)"),
        ("_brokers.json", ("update",), "บทวิเคราะห์โบรกเกอร์สะสม (brokers.py)"),
        ("_reports.json", ("update",), "รายงานที่อ่านแล้ว (research_desk.py)"),
        ("fin/*", BOTH, "งบการเงินรายตัว"),
        ("snap/*", BOTH, "ภาพคะแนนรายวัน (summarize.js)"),
        (".keys_v1", BOTH, "เครื่องหมายว่ารหัสหุ้นเป็นแบบไม่ซ้ำข้ามตลาดแล้ว"),
        ("*.json", BOTH, "ราคาย้อนหลังรายวัน 5 ปีรายตัว"),
    ],
}


def owners(branch, rel):
    """งานที่เขียนไฟล์นี้ได้ · None = ยังไม่ลงทะเบียน"""
    for pat, who, _ in OWNERS.get(branch, []):
        if fnmatch.fnmatchcase(rel, pat):
            return who
    return None


def _sha(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def files(d, branch):
    """ไฟล์ในขอบเขตของ branch: {path สัมพัทธ์: path เต็ม}"""
    _, _, rec, pat = SCOPES[branch]
    out = {}
    if not os.path.isdir(d):
        return out
    if rec:
        for r, ds, fs in os.walk(d):
            ds[:] = [x for x in ds if x != ".sync"]
            for f in fs:
                rel = os.path.relpath(os.path.join(r, f), d).replace(os.sep, "/")
                if rel != MANIFEST and fnmatch.fnmatchcase(rel, pat):
                    out[rel] = os.path.join(r, f)
    else:
        for f in os.listdir(d):
            p = os.path.join(d, f)
            if os.path.isfile(p) and f != MANIFEST and fnmatch.fnmatchcase(f, pat) and not f.startswith("."):
                out[f] = p
    return out


def hashes(d, branch):
    return {k: _sha(p) for k, p in files(d, branch).items()}


def plan(branch, job, local, base, remote, man, mtime):
    """เลือกทีละไฟล์ว่าใช้ของในเครื่อง ("local") หรือของบน branch ("remote")
    local/base/remote = {ไฟล์: hash} · man = _files.json บน branch {ไฟล์: [เวลาเขียน, งาน]} · mtime = {ไฟล์: เวลาเขียนในเครื่อง}"""
    pick, warn = {}, []
    for rel in sorted(set(local) | set(remote)):
        lc = rel in local and local[rel] != base.get(rel)
        rc = rel in remote and remote[rel] != base.get(rel)
        who = owners(branch, rel)
        if who is None and lc:
            warn.append(f"{rel}: ยังไม่ลงทะเบียนเจ้าของใน datasync.OWNERS")
        if lc and who is not None and job not in who:
            warn.append(f"{rel}: {job} ไม่ใช่เจ้าของ ({'/'.join(who)}) ใช้ของบน {branch}")
            pick[rel] = "remote" if rel in remote else "local"
        elif lc and rc:
            pick[rel] = "local" if mtime.get(rel, 0) >= ((man.get(rel) or [0])[0] or 0) else "remote"
        elif lc:
            pick[rel] = "local"
        elif rel in remote:
            pick[rel] = "remote"
        else:
            pick[rel] = "local"
    return pick, warn


def _git(*a, check=True):
    r = subprocess.run(["git", *a], cwd=ROOT, capture_output=True)
    if check and r.returncode:
        raise RuntimeError(f"git {' '.join(a[:2])}: {r.stderr.decode(errors='replace')[-300:]}")
    return r


def fetch(branch, tmp):
    """ดึง branch ล่าสุดมาแตกไว้ใน tmp คืน sha ("" = ยังไม่มี branch นี้) · ดึงไม่ได้ = ยกเลิก (ไม่ส่งแบบไม่รู้ของบน branch)"""
    ls = _git("ls-remote", "origin", f"refs/heads/{branch}").stdout.decode().split()
    if not ls:
        return ""
    _git("fetch", "-q", "--depth=1", "origin", f"+refs/heads/{branch}:refs/remotes/origin/{branch}")
    sha = _git("rev-parse", f"refs/remotes/origin/{branch}").stdout.decode().strip()
    sub = SCOPES[branch][1]
    tar = os.path.join(tmp, "x.tar")
    with open(tar, "wb") as f:
        r = subprocess.run(["git", "archive", sha] + ([sub] if sub else []), cwd=ROOT, stdout=f, stderr=subprocess.PIPE)
    if r.returncode == 0:
        with tarfile.open(tar) as t:
            if hasattr(tarfile, "data_filter"):
                t.extractall(os.path.join(tmp, "x"), filter="data")
            else:
                t.extractall(os.path.join(tmp, "x"))
    os.remove(tar)
    return sha


def _load(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


def _save(p, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p + ".tmp", "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(p + ".tmp", p)


def _copy(src, dst):
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    shutil.copy2(src, dst)


def mark(branch):
    _save(os.path.join(SYNC, branch + ".json"), hashes(os.path.join(ROOT, SCOPES[branch][0]), branch))


def merge(branch, job, out=None):
    """รวมไฟล์ของ branch กับของในเครื่อง · out=None = pull (แค่ดึงของใหม่มาใช้) · out=โฟลเดอร์ = stage (เตรียมส่ง)"""
    ldir = os.path.join(ROOT, SCOPES[branch][0])
    bpath = os.path.join(SYNC, branch + ".json")
    base = _load(bpath, {})
    lf = files(ldir, branch)
    local = {k: _sha(p) for k, p in lf.items()}
    mtime = {k: int(os.path.getmtime(p)) for k, p in lf.items()}
    with tempfile.TemporaryDirectory() as tmp:
        sha = fetch(branch, tmp)
        rdir = os.path.join(tmp, "x", SCOPES[branch][1]) if sha else os.path.join(tmp, "none")
        rf = files(rdir, branch)
        remote = {k: _sha(p) for k, p in rf.items()}
        man = _load(os.path.join(rdir, MANIFEST), {})
        pick, warn = plan(branch, job, local, base, remote, man, mtime)
        nbase, nman, now = dict(base), {}, int(time.time())
        for rel, w in pick.items():
            if w == "remote":
                if local.get(rel) != remote[rel]:
                    _copy(rf[rel], os.path.join(ldir, rel))  # งานนี้ใช้ของใหม่จาก branch ต่อด้วย
                nbase[rel] = base[rel] = remote[rel]  # ไฟล์ที่ดึงมาแทนแล้ว ฐานเปลี่ยนทันทีแม้รอบนี้ส่งไม่สำเร็จ
                nman[rel] = man.get(rel) or [0, "?"]
            else:
                changed = local[rel] != base.get(rel)
                nman[rel] = [mtime.get(rel, now), job] if changed else (man.get(rel) or [mtime.get(rel, now), job])
                if out:
                    nbase[rel] = local[rel]
        for rel in [k for k in nbase if k not in pick]:
            nbase.pop(rel)
        if out:
            for rel, w in pick.items():
                _copy(rf[rel] if w == "remote" else os.path.join(ldir, rel), os.path.join(out, rel))
            _save(os.path.join(out, MANIFEST), nman)
            _save(os.path.join(SYNC, branch + ".pending"), nbase)
            _save(bpath, {k: v for k, v in base.items() if k in pick})
            with open(os.path.join(SYNC, branch + ".lease"), "w") as f:
                f.write(sha)
        else:
            _save(bpath, nbase)
    took = sorted(k for k, w in pick.items() if w == "remote" and local.get(k) != remote.get(k))
    sent = sorted(k for k, w in pick.items() if w == "local" and local[k] != base.get(k))
    print(f"datasync {branch} {'stage' if out else 'pull'} ({job}): ส่งของในเครื่อง {len(sent)} ไฟล์ · ใช้ของใหม่จาก branch {len(took)} ไฟล์"
          + (f" ({', '.join(took[:8])}{' …' if len(took) > 8 else ''})" if took else ""))
    for w in warn[:20]:
        print("  เตือน:", w)
    return pick, warn


def done(branch):
    p = os.path.join(SYNC, branch + ".pending")
    if os.path.exists(p):
        os.replace(p, os.path.join(SYNC, branch + ".json"))


def main(argv):
    job = argv[argv.index("--job") + 1] if "--job" in argv else os.environ.get("SD_JOB", "update")
    args = [a for i, a in enumerate(argv) if a != "--job" and (i == 0 or argv[i - 1] != "--job")]
    cmd = args[0] if args else ""
    if job not in JOBS:
        sys.exit(f"ไม่รู้จักงาน {job}")
    if cmd == "mark":
        for b in args[1:] or [b for b in SCOPES if os.path.isdir(os.path.join(ROOT, SCOPES[b][0]))]:
            mark(b)
    elif cmd == "pull":
        merge(args[1], job)
    elif cmd == "stage":
        merge(args[1], job, os.path.abspath(args[2]))
    elif cmd == "done":
        done(args[1])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
