/*
      ========================= MAIN PROJECT COMMENT =========================
      ⚠️ WARNING FOR ANY AGENT / DEVELOPER (DO NOT DELETE) ⚠️
      - ممنوع حذف أي بلوك تعليق عليه "MAIN PROJECT COMMENT" في المشروع بالكامل.
      =======================================================================
    */

    const TASKS = [
      { id:"new-level", title:"علام جيت لِفل جديد", desc:"إثبات نقطتين + حساب م س م + حساب قراءة الجيت لفل + صور." },
      { id:"check-tbm-villa-wall", title:"تشييك تايبيم (TBM) فيلا أو سور", desc:"(لاحقًا) فورم مراجعة TBM." },
      { id:"check-slabs", title:"تشييك على الأسقف", desc:"(لاحقًا) فورم الأسقف." },
      { id:"check-excavation-level", title:"تشييك على منسوب الحفر", desc:"(لاحقًا) فورم الحفر." },
      { id:"stake-demarcation", title:"توقيع نقاط الديماركشن", desc:"(لاحقًا) فورم الديماركشن." },
      { id:"stake-villa-points", title:"توقيع نقاط داخل الفيلا", desc:"(لاحقًا) فورم نقاط الفيلا." },
      { id:"survey-for-consultant", title:"رفع أرض للاستشاري", desc:"(لاحقًا) فورم الرفع للاستشاري." },
      { id:"natural-ground-survey", title:"رفع أرض طبيعية", desc:"(لاحقًا) فورم الأرض الطبيعية." },
    ];

    const STORE_KEY = "field_site_onefile_v6";
    const TASK_KEY_PREFIX = "field_site_task_v1_";
    const STORAGE_MIGRATION_FLAG = "field_site_task_storage_migrated_v1";
    const state = { activeTaskId: null, tasksData: {} };

    const $ = (s, r=document) => r.querySelector(s);

    function safeStorageGet(key){
      try{
        return localStorage.getItem(key);
      }catch(_){
        return null;
      }
    }

    function safeStorageSet(key, value){
      try{
        localStorage.setItem(key, value);
        return true;
      }catch(_){
        return false;
      }
    }

    function safeStorageRemove(key){
      try{
        localStorage.removeItem(key);
        return true;
      }catch(_){
        return false;
      }
    }

    function taskStorageKey(taskId){
      return `${TASK_KEY_PREFIX}${taskId}`;
    }

    function escapeHtml(s){
      return String(s ?? "")
        .replaceAll("&","&amp;").replaceAll("<","&lt;")
        .replaceAll(">","&gt;").replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
    }
    function todayISO(){
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth()+1).padStart(2,"0");
      const dd = String(d.getDate()).padStart(2,"0");
      return `${yyyy}-${mm}-${dd}`;
    }
    function debounce(fn, ms){
      let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
    }
    function setSave(msg){
      // Save toast intentionally disabled.
    }

    function load(taskId){
      if(!taskId) return;

      const directRaw = safeStorageGet(taskStorageKey(taskId));
      if(directRaw){
        try{
          const parsed = JSON.parse(directRaw);
          if(parsed && typeof parsed === "object"){
            state.tasksData[taskId] = parsed;
            state.activeTaskId = taskId;
            return;
          }
        }catch(e){
          console.warn("Bad task state", e);
        }
      }

      // Backward compatibility: migrate from old single-key storage.
      if(safeStorageGet(STORAGE_MIGRATION_FLAG) === "1") return;
      const legacyRaw = safeStorageGet(STORE_KEY);
      if(!legacyRaw) return;
      try{
        const legacy = JSON.parse(legacyRaw);
        const legacyTasks = legacy?.tasksData;
        if(!legacyTasks || typeof legacyTasks !== "object"){
          safeStorageSet(STORAGE_MIGRATION_FLAG, "1");
          return;
        }

        for (const [legacyTaskId, legacyTaskData] of Object.entries(legacyTasks)) {
          if(!legacyTaskData || typeof legacyTaskData !== "object") continue;
          safeStorageSet(taskStorageKey(legacyTaskId), JSON.stringify(legacyTaskData));
        }

        safeStorageSet(STORAGE_MIGRATION_FLAG, "1");
        safeStorageRemove(STORE_KEY);

        const migratedRaw = safeStorageGet(taskStorageKey(taskId));
        if(!migratedRaw) return;
        const migrated = JSON.parse(migratedRaw);
        if(migrated && typeof migrated === "object"){
          state.tasksData[taskId] = migrated;
          state.activeTaskId = taskId;
        }
      }catch(e){
        console.warn("Bad legacy state", e);
      }
    }
    function save(){
      const taskId = state.activeTaskId;
      if(!taskId) return;
      try{
        const taskData = state.tasksData[taskId];
        const key = taskStorageKey(taskId);
        if(!taskData){
          safeStorageRemove(key);
        }else{
          safeStorageSet(key, JSON.stringify(taskData));
        }
        setSave("تم");
      }catch(e){
        console.error(e);
        setSave("فشل", false);
      }
    }
    const saveDebounced = debounce(save, 350);

    function fileToDataUrl(file){
      return new Promise((resolve, reject)=>{
        const r = new FileReader();
        r.onload = ()=> resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    }

    // Compress image before storing
    function compressImage(file, maxWidth=800, quality=0.7){
      return new Promise((resolve, reject)=>{
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = ()=>{
          try{
            if(img.width <= maxWidth){
              URL.revokeObjectURL(objectUrl);
              resolve(file);
              return;
            }
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const ratio = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = Math.round(img.height * ratio);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob)=>{
              URL.revokeObjectURL(objectUrl);
              resolve(blob || file);
            }, 'image/jpeg', quality);
          }catch(err){
            URL.revokeObjectURL(objectUrl);
            reject(err);
          }
        };
        img.onerror = (err)=>{
          URL.revokeObjectURL(objectUrl);
          reject(err);
        };
        img.src = objectUrl;
      });
    }
    function download(filename, text){
      const blob = new Blob([text], {type:"application/json"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href), 500);
    }

    function renderHomeCards(){
      $("#cards").innerHTML = TASKS.map((t) => {
        const isDone = Boolean(state.tasksData[t.id]);

        return `
        <a class="cardLink ${isDone ? "done" : ""}" href="#" data-open="${escapeHtml(t.id)}">
          <h3 class="cardTitle">${escapeHtml(t.title)}</h3>
        </a>
      `;
      }).join("");
    }

    function getSiteRootPrefix(){
      const fromWindow = typeof window.__FIELD_SITE_ROOT === "string"
        ? window.__FIELD_SITE_ROOT.trim()
        : "";
      const fromHtml = (document.documentElement?.getAttribute("data-site-root") || "").trim();
      const fallback = window.location.pathname.includes("/tasks/") ? "../" : "./";
      const root = fromWindow || fromHtml || fallback;
      if (!root) return "./";
      return root.endsWith("/") ? root : `${root}/`;
    }

    function resolveSitePath(path){
      const cleanPath = String(path || "").replace(/^\/+/, "");
      return `${getSiteRootPrefix()}${cleanPath}`;
    }

    function showHome(){
      window.location.href = resolveSitePath("index.html");
    }

    function ensureTaskData(taskId){
      state.tasksData[taskId] = state.tasksData[taskId] || { date: todayISO(), notes: "", photos: [] };

      if(taskId === "new-level"){
        const d = state.tasksData[taskId];
        d.project = d.project || { company:"", plotNo:"" };
        d.points  = d.points  || [];
        d.levelCalc = d.levelCalc || {
          p1:"", p2:"",
          bs1:"", fs2:"",
          toleranceCm: "" // user enters allowed difference
        };
        d.gate = d.gate || {
          gateLevel:"",
          reading:"",
          plus1mEnabled: false // ✅ toggle behavior
        };
        d.newLevelStep = d.newLevelStep || 1;
        d.site = d.site || "";
      }
    }

    function showTask(taskId){
      const task = TASKS.find(t => t.id === taskId);
      if(!task) return;

      ensureTaskData(taskId);

      state.activeTaskId = taskId;
      $("#viewTask").classList.add("active");
      $("#topTitle").textContent = task.title;
      $("#topSub").textContent = "إدخال البيانات والمخرجات الخاصة بالبند";
      $("#taskTitle").textContent = task.title;
      $("#taskDesc").textContent = task.desc;

      if(taskId === "new-level") renderNewLevelTask();
      else renderGenericTask(taskId);

      setSave("جاهز");
      saveDebounced();
    }

    function renderGenericTask(taskId){
      const d = state.tasksData[taskId];
      $("#taskBody").innerHTML = `
        <section class="card form-shell">
          <div class="form-main">
            <h2 class="h2">واجهة إدخال عام</h2>
            <div class="row2">
              <div>
                <label class="lbl">التاريخ</label>
                <input class="inp" type="date" id="genDate" value="${escapeHtml(d.date || todayISO())}">
              </div>
              <div>
                <label class="lbl">البند الحالي</label>
                <input class="inp" value="${escapeHtml(taskId)}" readonly>
              </div>
            </div>
            <label class="lbl">ملاحظات</label>
            <textarea class="inp" id="genNotes" rows="4" placeholder="اكتب ملاحظات التنفيذ...">${escapeHtml(d.notes||"")}</textarea>
          </div>
          <aside class="form-side">
            <p class="sideTitle">مخرجات سريعة</p>
            <div class="resultBox">
              Date = ${escapeHtml(d.date || todayISO())}<br>
              Notes length = ${String((d.notes || "").length)} chars
            </div>
            <p class="note">هذا نموذج عام لحين تجهيز فورم مخصص لكل بند.</p>
          </aside>
        </section>
      `;
      $("#genDate").addEventListener("input", ()=>{
        d.date = $("#genDate").value || todayISO();
        setSave("تم (تلقائي)");
        saveDebounced();
      });
      $("#genNotes").addEventListener("input", debounce(()=>{
        d.notes = $("#genNotes").value || "";
        setSave("تم (تلقائي)");
        saveDebounced();
      }, 300));
    }

    // ========================= NEW LEVEL =========================
    function renderNewLevelTask(){
      const d = state.tasksData["new-level"];
      const step = d.newLevelStep || 1;

      const steps = [
        {n:1, t:"بيانات المشروع"},
        {n:2, t:"النقاط"},
        {n:3, t:"الحسابات"},
        {n:4, t:"صور الموقع"}
      ];
      $("#stepsBar").style.display = "flex";
      $("#stepsBar").innerHTML = steps.map(s => `
        <span class="step ${s.n===step ? "active":""}">(${s.n}) ${escapeHtml(s.t)}</span>
      `).join("");

      $("#taskBody").innerHTML = `
        ${step===1 ? newLevelStep1HTML(d) : ""}
        ${step===2 ? newLevelStep2HTML(d) : ""}
        ${step===3 ? newLevelStep3HTML(d) : ""}
        ${step===4 ? newLevelStep4HTML(d) : ""}
      `;
      wireNewLevelStepEvents(d);
    }

    function newLevelStep1HTML(d){
      const companies = ["", "شركة 1", "شركة 2", "شركة 3"];
      const plotNos   = ["", "1", "2", "3", "4", "5"];
      return `
        <section class="card workflow-card">
          <div class="step-layout">
            <div class="step-main">
              <h2 class="h2">1) غرفة إدخال بيانات المشروع</h2>

              <div id="errorMsg1" style="color:#ff6a6a; display:none; margin-bottom:10px;">أكمل جميع البيانات المطلوبة (الشركة والأرض)</div>

              <div class="row2">
                <div>
                  <label class="lbl">التاريخ</label>
                  <input class="inp" type="date" id="nlDate" value="${escapeHtml(d.date || todayISO())}">
                </div>
                <div>
                  <label class="lbl">اسم الشركة</label>
                  <select id="nlCompany">
                    ${companies.map(c => `<option value="${escapeHtml(c)}" ${c===d.project.company?"selected":""}>${escapeHtml(c || "— اختر —")}</option>`).join("")}
                  </select>
                </div>
              </div>

              <div class="row2">
                <div>
                  <label class="lbl">رقم الأرض</label>
                  <select id="nlPlot">
                    ${plotNos.map(p => `<option value="${escapeHtml(p)}" ${p===d.project.plotNo?"selected":""}>${escapeHtml(p || "— اختر —")}</option>`).join("")}
                  </select>
                </div>
                <div>
                  <label class="lbl">الموقع (اختياري)</label>
                  <input class="inp" id="nlSite" value="${escapeHtml(d.site||"")}" placeholder="مثال: الشيخ زايد - قطعة ...">
                </div>
              </div>
            </div>

            <aside class="step-side">
              <p class="sideTitle">مخرجات هذه الخطوة</p>
              <div class="resultBox">
                Date = ${escapeHtml(d.date || todayISO())}<br>
                Company = ${escapeHtml(d.project.company || "—")}<br>
                Plot = ${escapeHtml(d.project.plotNo || "—")}<br>
                Site = ${escapeHtml(d.site || "—")}
              </div>
              <p class="note">بعد اكتمال الشركة ورقم الأرض انتقل للخطوة التالية.</p>
              <button class="btn primary" id="nlNext1">التالي: النقاط ➡️</button>
            </aside>
          </div>
        </section>
      `;
    }

    function newLevelStep2HTML(d){
      const points = d.points || [];
      const filledPoints = points.filter(p => String(p.name || "").trim() && String(p.rl ?? "").trim()).length;
      const rows = (d.points || []).map((p, i) => `
        <tr data-i="${i}">
          <td><input class="inp" data-p="name" value="${escapeHtml(p.name||"")}" placeholder="P1"></td>
          <td><input class="inp" data-p="rl" value="${escapeHtml(p.rl??"")}" placeholder="مثال: 12.345 (m)"></td>
          <td>
            <input class="inp" type="file" accept="image/*" data-pfile="${i}">
            ${p.photoDataUrl ? `<div class="thumbs" style="margin-top:8px"><div class="thumb"><button type="button" data-delpointimg="${i}">🗑️ حذف</button><img src="${p.photoDataUrl}" alt="point"></div></div>` : `<div class="note">صورة اختيارية</div>`}
          </td>
          <td><button class="btn danger" type="button" data-delpoint="${i}">🗑️ حذف النقطة</button></td>
        </tr>
      `).join("");

      return `
        <section class="card workflow-card">
          <h2 class="h2">2) غرفة إدخال النقاط</h2>

          <div id="errorMsg" style="color:#ff6a6a; display:none; margin-bottom:10px;">أكمل بيانات النقطة الأخيرة (الاسم والمنسوب)</div>
          <div id="errorMsg2" style="color:#ff6a6a; display:none; margin-bottom:10px;">لازم تدخل نقطتين على الأقل وتكمل الاسم والمنسوب</div>

          <div class="step-layout step-layout-wide">
            <div class="step-main">
              <div class="point-tools">
                <p class="note">يفضل إدخال المناسيب بالمتر (m). مثال: 12.345</p>
                <button class="btn ok" type="button" id="btnAddPoint">+ إضافة نقطة</button>
              </div>

              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style="text-align:right; font-family:inherit">اسم النقطة</th>
                      <th style="text-align:right; font-family:inherit">منسوبها (RL)</th>
                      <th style="text-align:right; font-family:inherit">صورة (اختياري)</th>
                      <th style="text-align:right; font-family:inherit">إجراء</th>
                    </tr>
                  </thead>
                  <tbody id="pointsBody">
                    ${rows || `<tr><td colspan="4" style="color:var(--muted); text-align:center; padding:14px; font-family:inherit">لا توجد نقاط بعد</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>

            <aside class="step-side">
              <p class="sideTitle">مخرجات الإدخال</p>
              <div class="resultBox">
                Total points = ${String(points.length)}<br>
                Complete rows = ${String(filledPoints)}<br>
                Minimum required = 2
              </div>
              <div class="workflow-nav">
                <button class="btn ghost" id="nlBack2">⬅️ رجوع</button>
                <button class="btn primary" id="nlNext2">التالي: الحسابات ➡️</button>
              </div>
            </aside>
          </div>
        </section>
      `;
    }

    // ========================= STEP 3 (UPDATED ENABLE/DISABLE FLOW + Tolerance split) =========================
    function newLevelStep3HTML(d){
      const pts = d.points || [];
      const opts = [`<option value="">— اختر نقطة —</option>`]
        .concat(pts.map(p => `<option value="${escapeHtml(p.name||"")}">${escapeHtml(p.name||"(بدون اسم)")}</option>`))
        .join("");

      const p1Chosen = d.levelCalc?.p1 || "";
      const optsP2 = [`<option value="">— اختر نقطة —</option>`]
        .concat(pts
          .filter(p => (p.name||"") !== p1Chosen)
          .map(p => `<option value="${escapeHtml(p.name||"")}">${escapeHtml(p.name||"(بدون اسم)")}</option>`))
        .join("");

      const calc = computeLevelSurface(d);
      const showAfter = calc.outsideTol === true; // only when outside tolerance (needs adjustment)

      const afterBlock = showAfter ? `
        <div class="resultBox adjust-box">
          <b>After Adjustment</b><br>
          C = ${calc.t.c} m  (added to points & MSM)<br><br>
          RL(P1)_adj = ${calc.t.rl1_adj}   (+${calc.t.c})<br>
          RL(P2)_adj = ${calc.t.rl2_adj}   (+${calc.t.c})<br>
          MSM_final  = ${calc.t.msm_final} (+${calc.t.c})
        </div>
      ` : `
        <div class="resultBox adjust-box adjust-ok" style="font-family:inherit">
          داخل السماحية. لا يحتاج متوسط أو تعديل إضافي.
        </div>
      `;

      // Final report fields (bottom)
      const plusText = calc.plus1mText;
      const dmdLevelText = calc.dmdLevelText;

      return `
        <section class="card calc-workspace">
          <div class="calc-grid">
            <div class="calc-panel calc-inputs">
              <h2 class="h2">3) غرفة الإدخال الحسابي</h2>

              <div id="errorMsg3" style="color:#ff6a6a; display:none; margin-bottom:10px;">أكمل جميع البيانات المطلوبة (النقاط والقراءات والتسامح)</div>
              <p class="note">القاعدة الأساسية: MSM = RL(Point1) + Reading1</p>

              <div class="row2">
                <div>
                  <label class="lbl">اختر النقطة 1</label>
                  <select id="p1Sel">${opts}</select>
                </div>
                <div>
                  <label class="lbl">Reading1 (m)</label>
                  <input class="inp" id="r1" value="${escapeHtml(d.levelCalc.bs1??"")}" placeholder="e.g. 1.235" disabled>
                </div>
              </div>

              <div class="row2">
                <div>
                  <label class="lbl">اختر النقطة 2</label>
                  <select id="p2Sel" disabled>${optsP2}</select>
                </div>
                <div>
                  <label class="lbl">Reading2 (m)</label>
                  <input class="inp" id="r2" value="${escapeHtml(d.levelCalc.fs2??"")}" placeholder="e.g. 1.987" disabled>
                </div>
              </div>

              <div class="row2">
                <div>
                  <label class="lbl">Difference (Δ) between points</label>
                  <input class="inp" id="deltaView" value="${escapeHtml(calc.t.delta)}" readonly disabled>
                  <p class="note">يظهر الفرق بعد إدخال القراءات.</p>
                </div>
                <div>
                  <label class="lbl">Allowed Difference (Tolerance) (cm)</label>
                  <input class="inp" id="tolCm" value="${escapeHtml(d.levelCalc.toleranceCm ?? "")}" placeholder="e.g. 2" disabled>
                </div>
              </div>

              <div class="row calc-actions">
                <button class="btn ok" type="button" id="btnRecalc" disabled>تحديث النتائج</button>
                <span class="badge ${calc.statusClass}">${calc.statusText}</span>
              </div>

              <div class="workflow-nav">
                <button class="btn ghost" id="nlBack3">⬅️ رجوع</button>
                <button class="btn primary" id="btnMarkDone">✅ تم وضع العلام → صور</button>
              </div>
            </div>

            <aside class="calc-panel calc-results">
              <h2 class="h2">لوحة الإخراج</h2>

              <div class="result-grid">
                <div class="metric">
                  <span class="metric-label">MSM_raw</span>
                  <strong class="metric-value">${calc.t.msm_raw}</strong>
                </div>
                <div class="metric">
                  <span class="metric-label">RL2_measured</span>
                  <strong class="metric-value">${calc.t.rl2_measured}</strong>
                </div>
                <div class="metric">
                  <span class="metric-label">Δ</span>
                  <strong class="metric-value">${calc.t.delta}</strong>
                </div>
                <div class="metric">
                  <span class="metric-label">MSM_final</span>
                  <strong class="metric-value">${calc.t.msm_final}</strong>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Operation</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>MSM_raw = RL1 + R1</td><td>${calc.t.msm_raw}</td></tr>
                  <tr><td>RL2_measured = MSM_raw - R2</td><td>${calc.t.rl2_measured}</td></tr>
                  <tr><td>Δ = RL2_measured - RL2_base</td><td>${calc.t.delta}</td></tr>
                  <tr><td>|Δ|</td><td>${calc.t.absDelta}</td></tr>
                  <tr><td>C = -Δ/2 (if |Δ| ≥ Tol)</td><td>${calc.t.c}</td></tr>
                  <tr><td>MSM_final = MSM_raw + C</td><td>${calc.t.msm_final}</td></tr>
                </tbody>
              </table>

              ${afterBlock}

              <div class="gate-panel">
                <h3 class="sideTitle">4) Gate Level Reading</h3>
                <div class="row2">
                  <div>
                    <label class="lbl">RL_target (Gate Level) (m)</label>
                    <input class="inp" id="gateLevel" value="${escapeHtml(d.gate.gateLevel??"")}" placeholder="e.g. 10.000">
                  </div>
                  <div>
                    <label class="lbl">Reading = MSM_final − RL_target</label>
                    <div class="row" style="gap:8px">
                      <input class="inp" id="gateReading" value="${escapeHtml(d.gate.reading??"")}" placeholder="—" readonly style="flex:1">
                      <button class="btn ghost" type="button" id="btnPlus1m">
                        ${d.gate.plus1mEnabled ? "−1m (ON)" : "+1m"}
                      </button>
                    </div>
                    <p class="note">أول ضغطة تضيف +1.00m، والثانية تلغيها.</p>
                  </div>
                </div>
              </div>

              <div class="resultBox final-mini" style="direction:ltr">
                <b>Final Report</b><br>
                Offset = ${plusText}<br>
                DMD Level = ${dmdLevelText} (DMD)
              </div>
            </aside>
          </div>
        </section>
      `;
    }

    function newLevelStep4HTML(d){
      return `
        <section class="card media-layout">
          <div class="media-upload">
            <h2 class="h2">5) غرفة إخراج صور الموقع</h2>
            <label class="lbl">اختيار الصور</label>
            <input class="inp" type="file" accept="image/*" multiple id="finalPhotoInput">
            <p class="note">الصور تحفظ محليًا على الجهاز حتى يتم التصدير.</p>

            <div class="workflow-nav">
              <button class="btn ghost" id="nlBack4">⬅️ رجوع</button>
              <button class="btn ok" id="btnExportNewLevel">📄 تصدير JSON</button>
            </div>
          </div>

          <aside class="media-preview">
            <p class="sideTitle">المخرجات المرئية</p>
            <div class="thumbs" id="finalThumbs"></div>
          </aside>
        </section>
      `;
    }
    // ========================= COMPUTATIONS =========================
    function toNum(x){
      const n = Number(String(x??"").replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }
    function getPointByName(d, name){
      return (d.points||[]).find(p => (p.name||"") === name) || null;
    }
    function fmt2(n){
      if(!Number.isFinite(n)) return "+0.00m";
      const s = (n>=0?"+":"") + n.toFixed(2) + "m";
      return s;
    }
    function fmt3(n){
      if(!Number.isFinite(n)) return "-";
      return n.toFixed(3);
    }

    function computeLevelSurface(d){
      const lc = d.levelCalc || {};
      const p1 = getPointByName(d, lc.p1 || "");
      const p2 = getPointByName(d, lc.p2 || "");

      const rl1 = p1 ? toNum(p1.rl) : null;
      const rl2base = p2 ? toNum(p2.rl) : null;

      const r1 = toNum(lc.bs1);
      const r2 = toNum(lc.fs2);

      const tolCm = toNum(lc.toleranceCm);
      const tolM = (tolCm!=null) ? (tolCm/100) : null;

      // +1m toggle affects target level (DMD)
      const plus1m = d.gate.plus1mEnabled ? 1.0 : 0.0;

      const out = {
        statusText: "ناقص بيانات",
        statusClass: "bad",
        outsideTol: false,
        t: {
          msm_raw:"-",
          rl2_measured:"-",
          delta:"-",
          absDelta:"-",
          c:"-",
          msm_final:"-",
          rl1_adj:"-",
          rl2_adj:"-"
        },
        plus1mValue: plus1m,
        plus1mText: fmt2(plus1m),
        dmdLevelText: "-"
      };

      // DMD level text = entered gate level + offset (if any)
      const gateLevel = toNum(d.gate.gateLevel);
      if(gateLevel!=null){
        out.dmdLevelText = (gateLevel + plus1m).toFixed(3);
      }else{
        out.dmdLevelText = "-";
      }

      // Can't compute core without points+readings
      if(rl1==null || rl2base==null || r1==null || r2==null){
        out.statusText = "أكمل الإدخال بالترتيب";
        out.statusClass = "bad";
        return out;
      }

      const msm_raw = rl1 + r1;
      const rl2_measured = msm_raw - r2;

      const delta = rl2_measured - rl2base;
      const absDelta = Math.abs(delta);

      // Fill core outputs always
      out.t.msm_raw = fmt3(msm_raw);
      out.t.rl2_measured = fmt3(rl2_measured);
      out.t.delta = fmt3(delta);
      out.t.absDelta = fmt3(absDelta);

      // If tolerance missing, stop here (still show Δ)
      if(tolM==null){
        out.statusText = `أدخل السماحية (Tolerance) — Δ=${delta.toFixed(3)}m`;
        out.statusClass = "bad";
        out.t.c = "-";
        out.t.msm_final = fmt3(msm_raw);
        out.t.rl1_adj = fmt3(rl1);
        out.t.rl2_adj = fmt3(rl2base);
        return out;
      }

      let c = 0;
      let msm_final = msm_raw;

      if(absDelta >= tolM){
        c = -(delta / 2);
        msm_final = msm_raw + c;
        out.statusText = `تم متوسط (خارج السماحية) | Δ=${delta.toFixed(3)}m`;
        out.statusClass = "bad";
        out.outsideTol = true;
      }else{
        out.statusText = `OK داخل السماحية | Δ=${delta.toFixed(3)}m`;
        out.statusClass = "ok";
        out.outsideTol = false;
      }

      const rl1_adj = rl1 + c;
      const rl2_adj = rl2base + c;

      out.t = {
        msm_raw: fmt3(msm_raw),
        rl2_measured: fmt3(rl2_measured),
        delta: fmt3(delta),
        absDelta: fmt3(absDelta),
        c: fmt3(c),
        msm_final: fmt3(msm_final),
        rl1_adj: fmt3(rl1_adj),
        rl2_adj: fmt3(rl2_adj)
      };

      return out;
    }

    function computeGateReading(d){
      const gateBase = toNum(d.gate.gateLevel);
      if(gateBase==null) return null;

      const plus1m = d.gate.plus1mEnabled ? 1.0 : 0.0;
      const target = gateBase + plus1m; // ✅ target changes

      const calc = computeLevelSurface(d);
      const msmFinal = toNum(calc.t.msm_final);
      if(msmFinal==null) return null;

      return msmFinal - target;
    }

    // ========================= EVENTS =========================
    function wireNewLevelStepEvents(d){
      const step = d.newLevelStep || 1;

      if(step===1){
        $("#nlDate").addEventListener("input", ()=>{
          d.date = $("#nlDate").value || todayISO();
          setSave("تم (تلقائي)");
          saveDebounced();
        });
        $("#nlCompany").addEventListener("change", ()=>{
          d.project.company = $("#nlCompany").value || "";
          setSave("تم (تلقائي)");
          saveDebounced();
        });
        $("#nlPlot").addEventListener("change", ()=>{
          d.project.plotNo = $("#nlPlot").value || "";
          setSave("تم (تلقائي)");
          saveDebounced();
        });
        $("#nlSite").addEventListener("blur", ()=>{
          d.site = $("#nlSite").value || "";
          setSave("تم (تلقائي)");
          saveDebounced();
        });
        $("#nlNext1").addEventListener("click", ()=>{
          const company = $("#nlCompany").value.trim();
          const plotNo = $("#nlPlot").value.trim();
          if(!company || !plotNo){
            $("#errorMsg1").style.display = "block";
            // Highlight the missing fields
            if(!company) $("#nlCompany").classList.add("error");
            if(!plotNo) $("#nlPlot").classList.add("error");
            setTimeout(() => {
              $("#nlCompany").classList.remove("error");
              $("#nlPlot").classList.remove("error");
              $("#errorMsg1").style.display = "none";
            }, 3000);
            return;
          }
          d.newLevelStep = 2;
          renderNewLevelTask();
          saveDebounced();
        });
      }

      if(step===2){
        $("#nlBack2").addEventListener("click", ()=>{
          d.newLevelStep = 1;
          renderNewLevelTask();
          saveDebounced();
        });
        $("#nlNext2").addEventListener("click", ()=>{
          const points = d.points || [];
          if(points.length < 2){
            $("#errorMsg2").style.display = "block";
            setTimeout(() => {
              $("#errorMsg2").style.display = "none";
            }, 3000);
            return;
          }
          for(let i = 0; i < points.length; i++){
            if(!String(points[i].name || "").trim() || !String(points[i].rl ?? "").trim()){
              $("#errorMsg2").style.display = "block";
              const row = $("#pointsBody").querySelector(`tr[data-i='${i}']`);
              if(row){
                row.classList.add("error");
                setTimeout(() => {
                  row.classList.remove("error");
                  $("#errorMsg2").style.display = "none";
                }, 3000);
              }
              return;
            }
          }
          d.newLevelStep = 3;
          renderNewLevelTask();
          saveDebounced();
        });
        $("#btnAddPoint").addEventListener("click", ()=>{
          const points = d.points || [];
          if(points.length > 0){
            const last = points[points.length - 1];
            if(!String(last.name || "").trim() || !String(last.rl ?? "").trim()){
              // Show error on the last point
              $("#errorMsg").style.display = "block";
              const lastRow = $("#pointsBody").querySelector(`tr[data-i='${points.length - 1}']`);
              if(lastRow){
                lastRow.classList.add("error");
                setTimeout(() => {
                  lastRow.classList.remove("error");
                  $("#errorMsg").style.display = "none";
                }, 3000);
              }
              return;
            }
          }
          d.points.push({name:"", rl:"", photoDataUrl:""});
          renderNewLevelTask();
          setSave("تم");
          saveDebounced();
        });

        const tbody = $("#pointsBody");
        if(tbody){
          tbody.addEventListener("blur", (e)=>{
            const tr = e.target.closest("tr[data-i]");
            if(!tr) return;
            const i = Number(tr.dataset.i);
            const key = e.target.dataset.p;
            if(!key) return;
            d.points[i][key] = e.target.value;
            setSave("تم (تلقائي)");
            saveDebounced();
          }, true);

          tbody.addEventListener("click", (e)=>{
            const del = e.target.closest("[data-delpoint]");
            if(del){
              const i = Number(del.dataset.delpoint);
              d.points.splice(i, 1);
              renderNewLevelTask();
              setSave("تم");
              saveDebounced();
              return;
            }
            const delImg = e.target.closest("[data-delpointimg]");
            if(delImg){
              const i = Number(delImg.dataset.delpointimg);
              d.points[i].photoDataUrl = "";
              renderNewLevelTask();
              setSave("تم");
              saveDebounced();
              return;
            }
          });

          tbody.addEventListener("change", async (e)=>{
            const inp = e.target.closest("[data-pfile]");
            if(!inp) return;
            const i = Number(inp.dataset.pfile);
            const file = inp.files?.[0];
            if(!file) return;
            const compressed = await compressImage(file);
            const dataUrl = await fileToDataUrl(compressed);
            d.points[i].photoDataUrl = dataUrl;
            inp.value = "";
            renderNewLevelTask();
            setSave("تم (صورة نقطة)");
            saveDebounced();
          });
        }
      }

      if(step===3){
        // Restore selections
        $("#p1Sel").value = d.levelCalc.p1 || "";
        $("#p2Sel").value = d.levelCalc.p2 || "";

        // Controls
        const p1Sel = $("#p1Sel");
        const r1Inp = $("#r1");
        const p2Sel = $("#p2Sel");
        const r2Inp = $("#r2");
        const tolInp = $("#tolCm");
        const btnCalc = $("#btnRecalc");
        const deltaView = $("#deltaView");

        // Enablement pipeline
        function refreshEnablement(){
          const hasP1 = !!(d.levelCalc.p1);
          r1Inp.disabled = !hasP1;

          const r1Val = toNum(d.levelCalc.bs1);
          p2Sel.disabled = !(hasP1 && r1Val!=null);

          const hasP2 = !!(d.levelCalc.p2);
          r2Inp.disabled = !(hasP1 && r1Val!=null && hasP2);

          const r2Val = toNum(d.levelCalc.fs2);
          tolInp.disabled = !(hasP1 && r1Val!=null && hasP2 && r2Val!=null);

          const tolVal = toNum(d.levelCalc.toleranceCm);
          btnCalc.disabled = !(hasP1 && r1Val!=null && hasP2 && r2Val!=null && tolVal!=null);

          // delta view enabled once both readings exist
          deltaView.disabled = !(hasP1 && r1Val!=null && hasP2 && r2Val!=null);
        }

        // Initial enablement
        refreshEnablement();

        p1Sel.addEventListener("change", ()=>{
          d.levelCalc.p1 = p1Sel.value || "";
          d.levelCalc.bs1 = "";
          d.levelCalc.p2 = "";
          d.levelCalc.fs2 = "";
          d.levelCalc.toleranceCm = "";
          // Auto-select remaining point if exactly 2 points
          const pts = d.points || [];
          if(pts.length === 2 && d.levelCalc.p1){
            const remaining = pts.find(p => (p.name||"") !== d.levelCalc.p1);
            if(remaining) d.levelCalc.p2 = remaining.name || "";
          }
          setSave("تم (تلقائي)");
          renderNewLevelTask();
          saveDebounced();
        });

        r1Inp.addEventListener("blur", ()=>{
          d.levelCalc.bs1 = r1Inp.value || "";
          setSave("تم (تلقائي)");
          renderNewLevelTask();
          saveDebounced();
        });

        p2Sel.addEventListener("change", ()=>{
          d.levelCalc.p2 = p2Sel.value || "";
          d.levelCalc.fs2 = "";
          d.levelCalc.toleranceCm = "";
          setSave("تم (تلقائي)");
          renderNewLevelTask();
          saveDebounced();
        });

        r2Inp.addEventListener("blur", ()=>{
          d.levelCalc.fs2 = r2Inp.value || "";
          setSave("تم (تلقائي)");
          renderNewLevelTask();
          saveDebounced();
        });

        tolInp.addEventListener("blur", ()=>{
          d.levelCalc.toleranceCm = tolInp.value || "";
          setSave("تم (تلقائي)");
          renderNewLevelTask();
          saveDebounced();
        });

        btnCalc.addEventListener("click", ()=>{
          renderNewLevelTask();
          setSave("تم (حساب)");
          saveDebounced();
        });

        // Gate
        $("#gateLevel").addEventListener("blur", ()=>{
          d.gate.gateLevel = $("#gateLevel").value || "";
          const r = computeGateReading(d);
          d.gate.reading = (r==null) ? "" : r.toFixed(3);
          $("#gateReading").value = d.gate.reading;
          setSave("تم (تلقائي)");
          renderNewLevelTask();
          saveDebounced();
        });

        // Fill reading now
        {
          const r = computeGateReading(d);
          d.gate.reading = (r==null) ? "" : r.toFixed(3);
          $("#gateReading").value = d.gate.reading;
        }

        // +1m toggle
        $("#btnPlus1m").addEventListener("click", ()=>{
          d.gate.plus1mEnabled = !d.gate.plus1mEnabled; // ✅ toggle
          const r = computeGateReading(d);
          d.gate.reading = (r==null) ? "" : r.toFixed(3);
          $("#gateReading").value = d.gate.reading;
          setSave(d.gate.plus1mEnabled ? "تم (+1m ON)" : "تم (+1m OFF)");
          renderNewLevelTask();
          saveDebounced();
        });

        $("#nlBack3").addEventListener("click", ()=>{
          d.newLevelStep = 2;
          renderNewLevelTask();
          saveDebounced();
        });

        $("#btnMarkDone").addEventListener("click", ()=>{
          const p1 = d.levelCalc.p1;
          const r1 = d.levelCalc.bs1;
          const p2 = d.levelCalc.p2;
          const r2 = d.levelCalc.fs2;
          const tol = d.levelCalc.toleranceCm;
          if(!p1 || !r1 || !p2 || !r2 || !tol){
            $("#errorMsg3").style.display = "block";
            // Highlight missing
            if(!p1) $("#p1Sel").classList.add("error");
            if(!r1) $("#r1").classList.add("error");
            if(!p2) $("#p2Sel").classList.add("error");
            if(!r2) $("#r2").classList.add("error");
            if(!tol) $("#tolCm").classList.add("error");
            setTimeout(() => {
              $("#p1Sel").classList.remove("error");
              $("#r1").classList.remove("error");
              $("#p2Sel").classList.remove("error");
              $("#r2").classList.remove("error");
              $("#tolCm").classList.remove("error");
              $("#errorMsg3").style.display = "none";
            }, 3000);
            return;
          }
          d.newLevelStep = 4;
          renderNewLevelTask();
          saveDebounced();
        });
      }

      if(step===4){
        renderFinalThumbs(d);

        $("#nlBack4").addEventListener("click", ()=>{
          d.newLevelStep = 3;
          renderNewLevelTask();
          saveDebounced();
        });

        $("#finalPhotoInput").addEventListener("change", async (e)=>{
          const files = Array.from(e.target.files || []);
          for(const f of files){
            const compressed = await compressImage(f);
            const dataUrl = await fileToDataUrl(compressed);
            d.photos.push({name:f.name, dataUrl});
          }
          e.target.value = "";
          renderFinalThumbs(d);
          setSave("تم (صور)");
          saveDebounced();
        });

        $("#finalThumbs").addEventListener("click", (e)=>{
          const btn = e.target.closest("button[data-del]");
          if(!btn) return;
          const i = Number(btn.dataset.del);
          d.photos.splice(i, 1);
          renderFinalThumbs(d);
          setSave("تم (حذف صورة)");
          saveDebounced();
        });

        $("#btnExportNewLevel").addEventListener("click", ()=>{
          const calc = computeLevelSurface(d);
          const gateBase = toNum(d.gate.gateLevel);
          const plus1m = d.gate.plus1mEnabled ? 1.0 : 0.0;
          const payload = {
            taskId: "new-level",
            taskTitle: "علام جيت لفل جديد",
            project: d.project,
            date: d.date,
            site: d.site || "",
            points: d.points,
            levelCalc: d.levelCalc,
            computed: {
              MSM_raw: calc.t.msm_raw,
              RL2_measured: calc.t.rl2_measured,
              delta_m: calc.t.delta,
              absDelta_m: calc.t.absDelta,
              correction_C: calc.t.c,
              MSM_final: calc.t.msm_final,
              RL1_adj: calc.t.rl1_adj,
              RL2_adj: calc.t.rl2_adj,
              status: calc.statusText
            },
            gate: {
              gateLevel_input: d.gate.gateLevel,
              plus1mEnabled: d.gate.plus1mEnabled,
              offset_m: plus1m,
              dmdLevel: (gateBase!=null) ? (gateBase + plus1m).toFixed(3) : null,
              reading: d.gate.reading
            },
            photosCount: d.photos.length,
            photos: d.photos
          };
          download(`new-level-${d.date||todayISO()}.json`, JSON.stringify(payload, null, 2));
          setSave("تم (تصدير)");
          saveDebounced();
        });
      }
    }

    function renderFinalThumbs(d){
      $("#finalThumbs").innerHTML = (d.photos||[]).map((p, i)=>`
        <div class="thumb">
          <button type="button" data-del="${i}">حذف</button>
          <img src="${p.dataUrl}" alt="${escapeHtml(p.name)}">
        </div>
      `).join("") || `<div class="note">لا توجد صور بعد</div>`;
    }
    function toggleTheme(){
      const isLight = document.body.classList.contains("light-mode");
      const newTheme = isLight ? "dark" : "light";
      safeStorageSet("theme", newTheme);
      document.body.classList.toggle("light-mode", !isLight);
      $("#themeToggle").textContent = newTheme === "light" ? "🌙" : "☀️";
    }

    function loadTheme(){
      // Keep the site on light mode as default/current appearance.
      safeStorageSet("theme", "light");
      document.body.classList.add("light-mode");
      $("#themeToggle").textContent = "🌙";
    }

    function wireGlobalEvents(){
      $("#btnBack").addEventListener("click", showHome);
      $("#btnResetTask").addEventListener("click", ()=>{
        const id = state.activeTaskId;
        if(!id || !state.tasksData[id]) {
          alert("لا توجد بيانات لمسحها");
          return;
        }
        if(!confirm("مسح كل بيانات هذا البند؟ هذا الإجراء لا يمكن التراجع عنه.")) return;
        delete state.tasksData[id];
        save();
        showHome();
      });
      $("#themeToggle").addEventListener("click", toggleTheme);
    }

    function getTaskIdFromUrl(){
      const params = new URLSearchParams(window.location.search);
      const taskId = String(params.get("task") || "").trim();
      return taskId || null;
    }

    function getTaskIdFromPage(){
      const fromWindow = typeof window.__TASK_ID__ === "string"
        ? window.__TASK_ID__.trim()
        : "";
      if (fromWindow) return fromWindow;

      const fromBody = (document.body?.dataset?.taskId || "").trim();
      if (fromBody) return fromBody;

      return null;
    }

    function renderTaskSkeleton(task){
      if (!task) return;
      $("#viewTask").classList.add("active");
      $("#topTitle").textContent = task.title;
      $("#topSub").textContent = "إدخال البيانات والمخرجات الخاصة بالبند";
      $("#taskTitle").textContent = task.title;
      $("#taskDesc").textContent = task.desc;
      $("#taskBody").innerHTML = `
        <section class="card">
          <p class="note">جاري تحميل بيانات البند...</p>
        </section>
      `;
    }

    (function init(){
      loadTheme();
      wireGlobalEvents();

      const requestedTaskId = getTaskIdFromPage() || getTaskIdFromUrl();
      const task = requestedTaskId ? TASKS.find(t => t.id === requestedTaskId) : null;

      if (task) {
        renderTaskSkeleton(task);
        // Defer heavy localStorage parse/render until after first paint.
        const run = () => {
          load(task.id);
          showTask(task.id);
          saveDebounced();
        };
        if ("requestAnimationFrame" in window) {
          requestAnimationFrame(() => setTimeout(run, 0));
        } else {
          setTimeout(run, 0);
        }
      } else {
        showHome();
      }
    })();
