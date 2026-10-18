import { useEffect, useLayoutEffect, useRef, useState } from "react";

type MainTab = "plant" | "closet" | "community" | "profile";
type Lang = "en" | "th";

type Step = {
  tab?: MainTab;
  click?: string;   // a sub-tab to click first (CSS selector)
  target?: string;  // element to highlight (CSS selector); none = centred message
  en: [string, string];
  th: [string, string];
};

const t = (name: string) => `[data-tour="${name}"]`;

const STEPS: Step[] = [
  { tab: "plant",
    en: ["Welcome to Reweave 🌱", "A 1-minute tour. Reweave rewards you for wearing what you own: you grow a cotton plant, build a digital closet, and share looks with a community that cares about textile waste."],
    th: ["ยินดีต้อนรับสู่ Reweave 🌱", "ทัวร์ 1 นาที Reweave ให้รางวัลคุณที่ใส่เสื้อผ้าที่มีอยู่ คุณจะปลูกต้นฝ้าย สร้างตู้เสื้อผ้าดิจิทัล และแบ่งปันลุคกับชุมชนที่ใส่ใจขยะสิ่งทอ"] },
  { tab: "plant", target: t("plant-stats"),
    en: ["Streak & buying credit", "Your watering streak and buying credits. Your first credit unlocks when your cotton reaches stage 4 (day 31). One credit = one safe clothing purchase."],
    th: ["สถิติการดูแลและสิทธิ์ซื้อ", "จำนวนวันที่ดูแลต้นฝ้ายต่อเนื่องและสิทธิ์ซื้อเสื้อผ้า สิทธิ์แรกจะได้รับเมื่อต้นฝ้ายถึงระยะที่ 4 (วันที่ 31) หนึ่งสิทธิ์ใช้ซื้อเสื้อผ้าได้หนึ่งครั้งโดยไม่ทำให้ต้นฝ้ายเฉา"] },
  { tab: "plant", target: t("water"),
    en: ["Water every day", "Tap once a day for +1 point. If 3 days pass without water, or you buy new clothes without a credit, your cotton withers and you start a new seed."],
    th: ["รดน้ำทุกวัน", "แตะวันละครั้งเพื่อรับ +1 คะแนน ถ้าไม่รดน้ำครบ 3 วัน หรือซื้อเสื้อผ้าใหม่โดยไม่มีสิทธิ์ ต้นฝ้ายจะเฉาและต้องเริ่มปลูกใหม่"] },
  { tab: "plant", target: t("journey"),
    en: ["Growth journey", "Five stages: Young (days 1–10), Medium (11–20), Flower (21–30), Cotton (31–40) and Full (41+). After Full your plant keeps counting days."],
    th: ["เส้นทางการเติบโต", "5 ระยะ: ต้นอ่อน (วัน 1–10), กลาง (11–20), ออกดอก (21–30), ปุยฝ้าย (31–40) และเต็มที่ (41+) หลังเต็มที่ ต้นฝ้ายจะนับวันต่อไป"] },
  { tab: "plant", target: t("funfact"),
    en: ["Daily textile fact", "A new fact about textile waste every day. Tap it to read more and open an awareness article."],
    th: ["ข้อมูลสิ่งทอประจำวัน", "ข้อเท็จจริงเรื่องขยะสิ่งทอใหม่ทุกวัน แตะเพื่ออ่านเพิ่มเติมและเปิดบทความ"] },

  { tab: "closet", click: t("wardrobe-tab"), target: t("add-piece"),
    en: ["Add a piece", "Upload a photo: the background is removed and the color is detected automatically. Use “Scan care tag” to read the fabric composition from the tag. Then pick type, style, occasion and closet."],
    th: ["เพิ่มเสื้อผ้า", "อัปโหลดรูป ระบบจะลบพื้นหลังและตรวจจับสีให้อัตโนมัติ ใช้ “สแกนป้ายเสื้อผ้า” เพื่ออ่านส่วนประกอบผ้าจากป้าย จากนั้นเลือกประเภท สไตล์ โอกาส และตู้"] },
  { tab: "closet", click: t("wardrobe-tab"), target: t("closet-tools"),
    en: ["Search & filter", "Find a piece by name, or filter by type, closet and color."],
    th: ["ค้นหาและกรอง", "ค้นหาเสื้อผ้าด้วยชื่อ หรือกรองตามประเภท ตู้ และสี"] },
  { tab: "closet", click: t("wardrobe-tab"), target: t("new-closet"),
    en: ["Your closets", "Make as many closets as you like (Work, Travel, Summer…). If you delete one, its clothes move to your default closet, “Everyday”, which can’t be deleted."],
    th: ["ตู้เสื้อผ้าของคุณ", "สร้างตู้ได้ตามต้องการ เช่น ตู้ชุดทำงาน ตู้ท่องเที่ยว หรือตู้ฤดูร้อน หากลบตู้ เสื้อผ้าจะย้ายไปยังตู้หลักซึ่งไม่สามารถลบได้"] },
  { tab: "closet", click: t("wardrobe-tab"), target: t("closet-shelf"),
    en: ["Each closet is a shelf", "Tap a piece to see its details, change its photo, edit its info or delete it."],
    th: ["ตู้แต่ละตู้คือชั้นวางเสื้อผ้า", "แตะเสื้อผ้าเพื่อดูรายละเอียด เปลี่ยนรูป แก้ไขข้อมูล หรือลบออกจากตู้"] },
  { tab: "closet", click: t("match-tab"), target: t("match-tab"),
    en: ["Match!", "Put pieces together into an outfit and save the styling. (Smart matching from a reference photo is coming soon.)"],
    th: ["จับคู่ชุด", "นำเสื้อผ้ามาจัดเป็นชุดแล้วบันทึกสไตล์ของคุณ (ระบบจับคู่อัตโนมัติจากรูปอ้างอิงกำลังอยู่ระหว่างพัฒนา)"] },

  { tab: "community", target: t("share-look"),
    en: ["Share your look", "Post an outfit for other members to see and respond to. Tag pieces from your closet or keep it private. A public post gives +3 bonus points once a day."],
    th: ["แชร์ลุคของคุณ", "โพสต์ชุดให้สมาชิกคนอื่นเห็นและแสดงความคิดเห็น แท็กเสื้อผ้าจากตู้หรือเก็บเป็นส่วนตัว โพสต์สาธารณะรับโบนัส +3 คะแนน วันละครั้ง"] },
  { tab: "community", target: t("community-search"),
    en: ["Find clothes & styles", "Search public outfit posts by clothing names, fashion details, or style tags."],
    th: ["ค้นหาเสื้อผ้าและสไตล์", "ค้นหาโพสต์ชุดสาธารณะด้วยชื่อเสื้อผ้า รายละเอียดแฟชั่น หรือแท็กสไตล์"] },
  { tab: "community", click: t("community-market-tab"), target: t("community-market-tab"),
    en: ["Buy & sell with members", "List your pre-loved clothes or buy from another member. Search listings by clothing type, fashion style, and tags. Checkout is a demo with PromptPay and QR options; it does not transfer money."],
    th: ["ซื้อขายกับสมาชิก", "ลงขายเสื้อผ้ามือสองหรือเลือกซื้อจากสมาชิก ค้นหาตามประเภทเสื้อผ้า สไตล์ และป้ายกำกับ ขั้นตอนชำระเงินเป็นเพียงตัวอย่าง มีตัวเลือกพร้อมเพย์และคิวอาร์โค้ด แต่ไม่มีการโอนเงินจริง"] },

  { tab: "profile", target: t("edit-profile"),
    en: ["Your profile", "Change your name, photo, age, and account details."],
    th: ["โปรไฟล์ของคุณ", "แก้ไขชื่อ รูป อายุ และรายละเอียดบัญชีของคุณ"] },
  { tab: "profile", target: t("profile-menu"),
    en: ["Points, friends & settings", "Spend points on coupons in the Point shop, chat with friends, manage privacy, and switch light or dark mode."],
    th: ["คะแนน เพื่อน และการตั้งค่า", "ใช้คะแนนแลกคูปองในร้านค้าคะแนน แชตกับเพื่อน ตั้งค่าความเป็นส่วนตัว และสลับโหมดสว่าง/มืด"] },
  { tab: "profile", target: t("friend-card"),
    en: ["Help a friend’s cotton", "Water your friends’ plants when they need it."],
    th: ["ช่วยรดน้ำต้นฝ้ายเพื่อน", "ช่วยรดน้ำต้นฝ้ายของเพื่อนเมื่อพวกเขาต้องการ"] },
  { tab: "profile", target: t("top-actions"),
    en: ["Top bar", "Switch language (EN/TH), toggle dark mode, and open your messages."],
    th: ["แถบเมนูด้านบน", "เปลี่ยนภาษาระหว่างอังกฤษกับไทย สลับโหมดมืด และเปิดกล่องข้อความ"] },
  { tab: "plant",
    en: ["You’re all set!", "Tap the ? button any time to see this tour again. Happy weaving 🧵"],
    th: ["พร้อมแล้ว!", "แตะปุ่ม ? ได้ทุกเมื่อเพื่อดูทัวร์นี้อีกครั้ง ขอให้สนุกกับการทอ 🧵"] },
];

const LABELS = {
  en: { next: "Next", back: "Back", done: "Done", skip: "Skip tour", help: "Help and tour", step: "Step" },
  th: { next: "ถัดไป", back: "ย้อนกลับ", done: "เสร็จสิ้น", skip: "ข้ามทัวร์", help: "ช่วยเหลือและทัวร์", step: "ขั้นตอน" },
};

/** Waits until an element exists (a tab may still be rendering after we switch to it). */
function waitFor(selector: string, timeout = 1800): Promise<Element | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (Date.now() - start > timeout) return resolve(null);
      setTimeout(tick, 60);
    };
    tick();
  });
}

export default function HelpTour({ lang, setTab, open, setOpen }: { lang: Lang; setTab: (tab: MainTab) => void; open: boolean; setOpen: (open: boolean) => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const targetRef = useRef<Element | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(200);
  const [sheetOpen, setSheetOpen] = useState(false);

  // hide the ? button while a sheet/dialog is open so it never covers a form
  useEffect(() => {
    const check = () => setSheetOpen(!!document.querySelector(".overlay"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const L = LABELS[lang];
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const close = () => { setOpen(false); setIndex(0); setRect(null); };
  const measure = () => setRect(targetRef.current ? targetRef.current.getBoundingClientRect() : null);

  // go to the step: switch tab → click sub-tab → find target → scroll to it
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    targetRef.current = null;
    setRect(null);
    if (step.tab) setTab(step.tab);
    (async () => {
      if (step.click) {
        const button = await waitFor(step.click);
        if (cancelled) return;
        (button as HTMLElement | null)?.click();
      }
      if (!step.target) return;
      const el = await waitFor(step.target);
      if (cancelled || !el) return;
      targetRef.current = el;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      measure();
      setTimeout(() => !cancelled && measure(), 400); // after the smooth scroll
    })();
    return () => { cancelled = true; };
  }, [open, index]);

  // keep the highlight attached while scrolling / resizing
  useLayoutEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setIndex((i) => Math.min(STEPS.length - 1, i + 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const [title, text] = step[lang];
  const pad = 8;

  // measure the card so it can be placed on whichever side of the highlight has room (never on top of it if avoidable)
  useLayoutEffect(() => {
    if (open && cardRef.current) setCardHeight(cardRef.current.getBoundingClientRect().height);
  }, [open, index, lang, rect]);

  const gap = 12, edge = 12;
  let cardPosition: React.CSSProperties = { top: "50%", transform: "translateY(-50%)" };
  if (rect) {
    const spaceAbove = rect.top - pad - gap - edge;
    const spaceBelow = window.innerHeight - (rect.bottom + pad) - gap - edge;
    const placeBelow = spaceBelow >= cardHeight || (spaceAbove < cardHeight && spaceBelow >= spaceAbove);
    const rawTop = placeBelow ? rect.bottom + pad + gap : rect.top - pad - gap - cardHeight;
    cardPosition = { top: Math.max(edge, Math.min(rawTop, window.innerHeight - cardHeight - edge)) };
  }

  return (
    <>
      <button
        aria-label={L.help}
        title={L.help}
        onClick={() => { setIndex(0); setOpen(true); }}
        style={{ position: "fixed", right: 16, bottom: "calc(98px + env(safe-area-inset-bottom))", zIndex: 60, width: 48, height: 48, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--green-deep)", color: "var(--paper)", fontSize: 22, fontWeight: 700, cursor: "pointer", boxShadow: "var(--shadow)", display: open || sheetOpen ? "none" : "grid", placeItems: "center" }}
      >?</button>

      {open && (
        <>
          {/* blocks clicks on the page behind the tour */}
          <div style={{ position: "fixed", inset: 0, zIndex: 9997, background: rect ? "transparent" : "rgba(8,20,14,.62)" }} />
          {rect && (
            <div style={{ position: "fixed", zIndex: 9998, pointerEvents: "none", left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, borderRadius: 16, boxShadow: "0 0 0 9999px rgba(8,20,14,.62), 0 0 0 3px var(--green)", transition: "all .25s ease" }} />
          )}
          <div ref={cardRef} role="dialog" aria-live="polite" aria-label={title} style={{ position: "fixed", zIndex: 9999, left: 0, right: 0, margin: "0 auto", width: "min(340px, 90vw)", ...cardPosition, background: "var(--paper)", color: "var(--ink)", borderRadius: 20, padding: 20, boxShadow: "var(--shadow)", border: "1px solid var(--line)", display: "grid", gap: 10 }}>
            <small style={{ color: "var(--ink-soft)" }}>{L.step} {index + 1} / {STEPS.length}</small>
            <strong style={{ fontSize: 18, fontFamily: "Newsreader, serif" }}>{title}</strong>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--ink-soft)" }}>{text}</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <button className="text-button" onClick={close} style={{ marginRight: "auto" }}>{L.skip}</button>
              {index > 0 && <button className="secondary-button" onClick={() => setIndex(index - 1)}>{L.back}</button>}
              <button className="primary-button" onClick={() => (last ? close() : setIndex(index + 1))}>{last ? L.done : L.next}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}