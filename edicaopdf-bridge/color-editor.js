/* EdiçãoPDF — Editor de Cor PDF */
/* global state, titles, switchTool, toast, setBusy, downloadBytes, PDFLib, pdfjsLib */
(() => {
  const SCALE_BY_QUALITY = { light: 1.25, balanced: 1.65, high: 2.05 };
  const runtime = {
    file: null,
    bytes: null,
    pageCount: 0,
    currentPage: 1,
    pdfjsDoc: null,
    previewToken: 0,
    rendering: false,
  };

  state.colorEditor = runtime;
  titles.colorEditor = 'Editor de Cor PDF';

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2).replace('.', ',')} MB`;
  }

  function baseName(name) {
    return String(name || 'arquivo').replace(/\.pdf$/i, '');
  }

  function injectStyles() {
    if (document.querySelector('style[data-color-editor]')) return;
    const style = document.createElement('style');
    style.dataset.colorEditor = 'true';
    style.textContent = `
      .color-editor-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;align-items:start}
      .color-editor-card{background:var(--surface,#11151d);border:1px solid var(--border,#252a35);border-radius:16px;padding:16px}
      .color-editor-upload{margin-bottom:16px}
      .color-file{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border,#252a35);border-radius:12px;background:var(--surface-2,#171b24);margin-bottom:14px}.color-file .file-badge{flex:0 0 auto}.color-file-info{min-width:0;flex:1}.color-file-info strong,.color-file-info span{display:block}.color-file-info strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.color-file-info span{margin-top:3px;color:var(--muted,#929aaa);font-size:12px}
      .color-preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.color-preview-toolbar strong,.color-preview-toolbar span{display:block}.color-preview-toolbar span{margin-top:3px;color:var(--muted,#929aaa);font-size:12px}.color-page-nav{display:flex;align-items:center;gap:8px}.color-page-nav button{width:34px;height:34px;border:1px solid var(--border,#303642);background:transparent;color:inherit;border-radius:9px;cursor:pointer}.color-page-nav button:disabled{opacity:.35}.color-page-nav span{min-width:72px;text-align:center;margin:0}
      .color-preview-wrap{min-height:420px;display:grid;place-items:center;border:1px dashed var(--border,#303642);border-radius:14px;background:#080a0f;padding:16px;overflow:auto}.color-preview-wrap canvas{max-width:100%;height:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);background:#fff}.color-preview-empty{color:var(--muted,#929aaa);font-size:13px;text-align:center}
      .color-options{display:grid;gap:12px}.color-note{padding:11px 12px;border:1px solid rgba(239,68,68,.22);background:rgba(239,68,68,.07);border-radius:11px;color:var(--muted,#aab1bd);font-size:12px;line-height:1.5}.color-note strong{color:var(--text,#fff)}
      .color-threshold-value{font-size:12px;color:var(--muted,#929aaa);margin-top:4px}.color-editor-hidden{display:none!important}
      .color-preview-status{margin-top:10px;color:var(--muted,#929aaa);font-size:12px;line-height:1.45}
      @media(max-width:900px){.color-editor-layout{grid-template-columns:1fr}.color-editor-options{order:-1}.color-preview-wrap{min-height:300px}}
    `;
    document.head.appendChild(style);
  }

  function installUi() {
    if (document.querySelector('[data-tool="colorEditor"]')) return;
    injectStyles();

    const mergeButton = document.querySelector('[data-tool="merge"]');
    const anchor = mergeButton || document.querySelector('[data-tool="compress"]') || document.querySelector('.tool-nav .nav-item');
    anchor.insertAdjacentHTML('afterend', `<button class="nav-item" data-tool="colorEditor"><span class="nav-icon">◐</span><span>Editor de Cor PDF</span></button>`);
    document.querySelector('[data-tool="colorEditor"]').addEventListener('click', () => switchTool('colorEditor'));

    const reference = document.querySelector('#tool-split') || document.querySelector('#tool-print');
    reference.insertAdjacentHTML('beforebegin', `
      <section class="tool-panel" id="tool-colorEditor">
        <div class="section-header">
          <div><span class="section-tag">COR E IMPRESSÃO</span><h2>Editor de Cor PDF</h2><p>Remova cores, transforme o documento em preto puro ou tons de cinza e baixe uma nova cópia pronta para impressão.</p></div>
        </div>
        <label class="upload-zone color-editor-upload" id="colorEditorDrop"><input type="file" id="colorEditorInput" accept="application/pdf,.pdf" hidden /><span class="upload-icon">◐</span><strong>Selecionar PDF</strong><small>ou arraste o arquivo aqui</small></label>
        <div class="color-editor-layout color-editor-hidden" id="colorEditorWorkspace">
          <div class="color-editor-card">
            <div class="color-file">
              <div class="file-badge">PDF</div>
              <div class="color-file-info"><strong id="colorEditorFileName">arquivo.pdf</strong><span id="colorEditorFileMeta">0 páginas</span></div>
              <button class="icon-button" id="colorEditorReset" type="button" aria-label="Trocar arquivo">×</button>
            </div>
            <div class="color-preview-toolbar">
              <div><strong>Prévia</strong><span>Veja o efeito antes de converter o PDF inteiro.</span></div>
              <div class="color-page-nav"><button id="colorPrevPage" type="button">←</button><span id="colorPageLabel">1 / 1</span><button id="colorNextPage" type="button">→</button></div>
            </div>
            <div class="color-preview-wrap"><canvas id="colorPreviewCanvas" width="1" height="1"></canvas><div class="color-preview-empty color-editor-hidden" id="colorPreviewEmpty">Carregue um PDF para visualizar.</div></div>
            <div class="color-preview-status" id="colorPreviewStatus">Aguardando arquivo.</div>
          </div>
          <aside class="color-editor-card color-editor-options">
            <div class="color-options">
              <label class="field"><span>Modo de cor</span><select id="colorEditorMode"><option value="bw" selected>Preto e branco — preto puro</option><option value="gray">Tons de cinza — sem cores</option><option value="original">Original — sem alteração</option></select></label>
              <label class="field"><span>Qualidade</span><select id="colorEditorQuality"><option value="light">Leve</option><option value="balanced" selected>Equilibrada</option><option value="high">Alta qualidade</option></select></label>
              <label class="field" id="colorEditorThresholdField"><span>Força do preto</span><input id="colorEditorThreshold" type="range" min="100" max="235" step="1" value="185" /><div class="color-threshold-value">Valor: <strong id="colorEditorThresholdValue">185</strong></div></label>
              <label class="field"><span>Nome do arquivo</span><input id="colorEditorOutputName" type="text" maxlength="80" value="pdf-preto-e-branco" /></label>
              <div class="color-note" id="colorEditorNote"><strong>Preto puro:</strong> cada pixel vira somente preto ou branco. Ideal quando você quer eliminar qualquer cor antes da impressão.</div>
              <button class="btn primary full-width" id="colorEditorRun" type="button" disabled>Converter e baixar PDF</button>
            </div>
          </aside>
        </div>
      </section>`);

    const drop = document.querySelector('#colorEditorDrop');
    const input = document.querySelector('#colorEditorInput');
    input.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) loadFile(file);
      event.target.value = '';
    });
    ['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.add('dragging'); }));
    ['dragleave', 'drop'].forEach((type) => drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.remove('dragging'); }));
    drop.addEventListener('drop', (event) => {
      const file = [...event.dataTransfer.files].find((item) => item.type === 'application/pdf' || /\.pdf$/i.test(item.name));
      if (file) loadFile(file); else toast('Selecione um arquivo PDF.', true);
    });

    document.querySelector('#colorEditorReset').addEventListener('click', resetFile);
    document.querySelector('#colorPrevPage').addEventListener('click', () => changePage(-1));
    document.querySelector('#colorNextPage').addEventListener('click', () => changePage(1));
    document.querySelector('#colorEditorMode').addEventListener('change', () => { syncControls(); renderPreview(); });
    document.querySelector('#colorEditorQuality').addEventListener('change', renderPreview);
    document.querySelector('#colorEditorThreshold').addEventListener('input', (event) => {
      document.querySelector('#colorEditorThresholdValue').textContent = event.target.value;
      renderPreview();
    });
    document.querySelector('#colorEditorRun').addEventListener('click', convertPdf);
    syncControls();
  }

  function syncControls() {
    const mode = document.querySelector('#colorEditorMode')?.value || 'bw';
    const thresholdField = document.querySelector('#colorEditorThresholdField');
    const note = document.querySelector('#colorEditorNote');
    const name = document.querySelector('#colorEditorOutputName');
    thresholdField.classList.toggle('color-editor-hidden', mode !== 'bw');
    if (mode === 'bw') {
      note.innerHTML = '<strong>Preto puro:</strong> cada pixel vira somente preto ou branco. Ideal quando você quer eliminar qualquer cor antes da impressão.';
      if (!name.dataset.userEdited) name.value = runtime.file ? `${baseName(runtime.file.name)}-preto-e-branco` : 'pdf-preto-e-branco';
    } else if (mode === 'gray') {
      note.innerHTML = '<strong>Tons de cinza:</strong> todas as cores são removidas, preservando variações de cinza para fotos, sombras e degradês.';
      if (!name.dataset.userEdited) name.value = runtime.file ? `${baseName(runtime.file.name)}-tons-de-cinza` : 'pdf-tons-de-cinza';
    } else {
      note.innerHTML = '<strong>Original:</strong> nenhuma conversão de cor será aplicada. O PDF será apenas salvo novamente.';
      if (!name.dataset.userEdited) name.value = runtime.file ? `${baseName(runtime.file.name)}-original` : 'pdf-original';
    }
  }

  async function loadFile(file) {
    setBusy(true, 'Analisando o PDF...');
    try {
      if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) throw new Error('Selecione um arquivo PDF.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
      const pdfjsDoc = await loadingTask.promise;
      if (runtime.pdfjsDoc) {
        try { runtime.pdfjsDoc.destroy?.(); } catch (_) {}
      }
      runtime.file = file;
      runtime.bytes = bytes;
      runtime.pageCount = pdfjsDoc.numPages;
      runtime.currentPage = 1;
      runtime.pdfjsDoc = pdfjsDoc;
      document.querySelector('#colorEditorFileName').textContent = file.name;
      document.querySelector('#colorEditorFileMeta').textContent = `${runtime.pageCount} página${runtime.pageCount === 1 ? '' : 's'} • ${formatBytes(file.size)}`;
      document.querySelector('#colorEditorDrop').classList.add('color-editor-hidden');
      document.querySelector('#colorEditorWorkspace').classList.remove('color-editor-hidden');
      document.querySelector('#colorEditorRun').disabled = false;
      const outputName = document.querySelector('#colorEditorOutputName');
      delete outputName.dataset.userEdited;
      outputName.oninput = () => { outputName.dataset.userEdited = 'true'; };
      syncControls();
      syncPageNav();
      await renderPreview();
    } catch (error) {
      console.error(error);
      toast(error.message || 'Não foi possível abrir este PDF.', true);
    } finally {
      setBusy(false);
    }
  }

  function resetFile() {
    runtime.previewToken += 1;
    if (runtime.pdfjsDoc) {
      try { runtime.pdfjsDoc.destroy?.(); } catch (_) {}
    }
    runtime.file = null;
    runtime.bytes = null;
    runtime.pageCount = 0;
    runtime.currentPage = 1;
    runtime.pdfjsDoc = null;
    document.querySelector('#colorEditorDrop').classList.remove('color-editor-hidden');
    document.querySelector('#colorEditorWorkspace').classList.add('color-editor-hidden');
    document.querySelector('#colorEditorRun').disabled = true;
    const canvas = document.querySelector('#colorPreviewCanvas');
    canvas.width = 1; canvas.height = 1;
  }

  function changePage(delta) {
    if (!runtime.pageCount) return;
    runtime.currentPage = Math.max(1, Math.min(runtime.pageCount, runtime.currentPage + delta));
    syncPageNav();
    renderPreview();
  }

  function syncPageNav() {
    document.querySelector('#colorPageLabel').textContent = `${runtime.currentPage} / ${Math.max(1, runtime.pageCount)}`;
    document.querySelector('#colorPrevPage').disabled = runtime.currentPage <= 1;
    document.querySelector('#colorNextPage').disabled = runtime.currentPage >= runtime.pageCount;
  }

  function convertPixels(imageData, mode, threshold) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = Math.round((r * 299 + g * 587 + b * 114) / 1000);
      const value = mode === 'bw' ? (gray < threshold ? 0 : 255) : gray;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    return imageData;
  }

  async function renderPreview() {
    if (!runtime.pdfjsDoc || runtime.rendering) return;
    const token = ++runtime.previewToken;
    const status = document.querySelector('#colorPreviewStatus');
    status.textContent = 'Atualizando prévia...';
    try {
      const page = await runtime.pdfjsDoc.getPage(runtime.currentPage);
      if (token !== runtime.previewToken) return;
      const mode = document.querySelector('#colorEditorMode').value;
      const threshold = Number(document.querySelector('#colorEditorThreshold').value || 185);
      const canvas = document.querySelector('#colorPreviewCanvas');
      const wrap = canvas.parentElement;
      const base = page.getViewport({ scale: 1 });
      const maxWidth = Math.max(320, Math.min(780, wrap.clientWidth - 34 || 720));
      const scale = Math.max(.55, Math.min(1.6, maxWidth / base.width));
      const viewport = page.getViewport({ scale });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
      if (token !== runtime.previewToken) return;
      if (mode !== 'original') {
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        ctx.putImageData(convertPixels(pixels, mode, threshold), 0, 0);
      }
      status.textContent = mode === 'bw' ? 'Prévia em preto e branco puro.' : mode === 'gray' ? 'Prévia em tons de cinza.' : 'Prévia com as cores originais.';
      page.cleanup();
    } catch (error) {
      console.error(error);
      status.textContent = 'Não foi possível atualizar a prévia desta página.';
    }
  }

  async function canvasToJpegBytes(canvas, quality) {
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Falha ao gerar a página convertida.')), 'image/jpeg', quality));
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function convertPdf() {
    if (!runtime.file || !runtime.bytes) return toast('Selecione um PDF.', true);
    const mode = document.querySelector('#colorEditorMode').value;
    const qualityKey = document.querySelector('#colorEditorQuality').value;
    const threshold = Number(document.querySelector('#colorEditorThreshold').value || 185);
    const outputName = (document.querySelector('#colorEditorOutputName').value || 'pdf-convertido').trim().replace(/[\\/:*?"<>|]+/g, '-');

    runtime.rendering = true;
    document.querySelector('#colorEditorRun').disabled = true;
    setBusy(true, mode === 'original' ? 'Preparando o PDF...' : 'Convertendo as cores do PDF...');
    try {
      if (mode === 'original') {
        downloadBytes(runtime.bytes.slice(), `${outputName}.pdf`);
        toast('PDF salvo sem alteração de cor.');
        return;
      }

      const loadingTask = pdfjsLib.getDocument({ data: runtime.bytes.slice() });
      const source = await loadingTask.promise;
      const output = await PDFLib.PDFDocument.create();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
      const renderScale = SCALE_BY_QUALITY[qualityKey] || SCALE_BY_QUALITY.balanced;

      try {
        for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
          const page = await source.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: renderScale });
          canvas.width = Math.max(1, Math.ceil(viewport.width));
          canvas.height = Math.max(1, Math.ceil(viewport.height));
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          ctx.putImageData(convertPixels(pixels, mode, threshold), 0, 0);
          const jpgBytes = await canvasToJpegBytes(canvas, mode === 'bw' ? .94 : .91);
          const image = await output.embedJpg(jpgBytes);
          const outPage = output.addPage([baseViewport.width, baseViewport.height]);
          outPage.drawImage(image, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });
          const busyText = document.querySelector('#busyText, .busy-overlay strong, [data-busy-text]');
          if (busyText) busyText.textContent = `Convertendo página ${pageNumber}/${source.numPages}`;
          page.cleanup();
        }
      } finally {
        source.cleanup?.();
        source.destroy?.();
      }

      output.setTitle(`${baseName(runtime.file.name)} - Editor de Cor PDF`);
      output.setCreator('EdiçãoPDF');
      const bytes = await output.save({ useObjectStreams: true });
      downloadBytes(bytes, `${outputName}.pdf`);
      toast(mode === 'bw' ? 'PDF convertido para preto e branco.' : 'PDF convertido para tons de cinza.');
    } catch (error) {
      console.error(error);
      toast('Não foi possível converter as cores deste PDF.', true);
    } finally {
      runtime.rendering = false;
      document.querySelector('#colorEditorRun').disabled = !runtime.file;
      setBusy(false);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUi);
  else installUi();
})();