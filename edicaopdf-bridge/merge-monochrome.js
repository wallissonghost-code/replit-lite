/* EdiçãoPDF — Mesclar PDF com saída monocromática */
/* global state, PDFLib, pdfjsLib, setBusy, downloadBytes, toast */
(() => {
  const SCALE_BY_QUALITY = { light: 1.25, balanced: 1.65, high: 2.05 };

  function installUi() {
    const wrap = document.querySelector('#mergeListWrap');
    const oldButton = document.querySelector('#mergeRun');
    if (!wrap || !oldButton || document.querySelector('#mergeColorMode')) return;
    const footer = oldButton.closest('.action-footer');
    const panel = document.createElement('div');
    panel.className = 'merge-color-panel';
    panel.innerHTML = `
      <div class="merge-color-head"><div><strong>Cor do PDF final</strong><span>Opcional: remova todas as cores antes de juntar.</span></div></div>
      <div class="merge-color-grid">
        <label class="field"><span>Modo de cor</span><select id="mergeColorMode"><option value="original" selected>Original — manter as cores</option><option value="bw">Preto e branco — preto puro</option><option value="gray">Tons de cinza — sem cores</option></select></label>
        <label class="field"><span>Qualidade</span><select id="mergeMonoQuality"><option value="light">Leve</option><option value="balanced" selected>Equilibrada</option><option value="high">Alta</option></select></label>
        <label class="field hidden" id="mergeThresholdField"><span>Força do preto</span><input id="mergeThreshold" type="range" min="100" max="235" step="1" value="185" /><small id="mergeThresholdValue">185</small></label>
      </div>
      <div class="merge-color-note hidden" id="mergeColorNote">No modo monocromático, as páginas são renderizadas como imagem para garantir que nenhuma cor permaneça. O texto pode deixar de ser selecionável/pesquisável.</div>`;
    footer.parentNode.insertBefore(panel, footer);
    if (!document.querySelector('style[data-merge-monochrome]')) {
      const style = document.createElement('style');
      style.dataset.mergeMonochrome = 'true';
      style.textContent = `.merge-color-panel{margin-top:14px;padding:14px;border:1px solid var(--border,#252a35);border-radius:14px;background:var(--surface-2,#151922)}.merge-color-head strong,.merge-color-head span{display:block}.merge-color-head span{margin-top:3px;color:var(--muted,#929aaa);font-size:12px}.merge-color-grid{display:grid;grid-template-columns:1.4fr .8fr 1fr;gap:10px;margin-top:12px}.merge-color-grid .field small{display:block;margin-top:5px;color:var(--muted,#929aaa)}.merge-color-note{margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.22);color:var(--muted,#aab1bd);font-size:12px;line-height:1.45}.merge-color-note.hidden,.merge-color-grid .hidden{display:none}@media(max-width:760px){.merge-color-grid{grid-template-columns:1fr}}`;
      document.head.appendChild(style);
    }
    const mode = document.querySelector('#mergeColorMode');
    const thresholdField = document.querySelector('#mergeThresholdField');
    const threshold = document.querySelector('#mergeThreshold');
    const thresholdValue = document.querySelector('#mergeThresholdValue');
    const note = document.querySelector('#mergeColorNote');
    const sync = () => { const mono = mode.value !== 'original'; thresholdField.classList.toggle('hidden', mode.value !== 'bw'); note.classList.toggle('hidden', !mono); };
    mode.addEventListener('change', sync);
    threshold.addEventListener('input', () => { thresholdValue.textContent = threshold.value; });
    sync();
    const newButton = oldButton.cloneNode(true);
    oldButton.replaceWith(newButton);
    newButton.addEventListener('click', runMergeWithColor);
  }

  async function mergeOriginal(records) {
    const output = await PDFLib.PDFDocument.create();
    for (const record of records) {
      const source = await PDFLib.PDFDocument.load(record.bytes.slice());
      const pages = await output.copyPages(source, source.getPageIndices());
      pages.forEach((page) => output.addPage(page));
    }
    return output.save();
  }
  function convertPixels(imageData, mode, threshold) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000);
      const value = mode === 'bw' ? (gray < threshold ? 0 : 255) : gray;
      data[i] = value; data[i + 1] = value; data[i + 2] = value; data[i + 3] = 255;
    }
    return imageData;
  }
  async function canvasToJpegBytes(canvas, quality = .92) {
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Falha ao gerar imagem da página.')), 'image/jpeg', quality));
    return new Uint8Array(await blob.arrayBuffer());
  }
  async function mergeMonochrome(records, mode, renderScale, threshold) {
    const output = await PDFLib.PDFDocument.create();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    let pageCounter = 0;
    const totalPages = records.reduce((sum, record) => sum + (record.pages || 0), 0);
    for (const record of records) {
      const loadingTask = pdfjsLib.getDocument({ data: record.bytes.slice() });
      const source = await loadingTask.promise;
      try {
        for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
          pageCounter += 1;
          const pdfPage = await source.getPage(pageNumber);
          const baseViewport = pdfPage.getViewport({ scale: 1 });
          const viewport = pdfPage.getViewport({ scale: renderScale });
          canvas.width = Math.max(1, Math.ceil(viewport.width));
          canvas.height = Math.max(1, Math.ceil(viewport.height));
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          await pdfPage.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          ctx.putImageData(convertPixels(pixels, mode, threshold), 0, 0);
          const jpgBytes = await canvasToJpegBytes(canvas, mode === 'bw' ? .94 : .91);
          const image = await output.embedJpg(jpgBytes);
          const outPage = output.addPage([baseViewport.width, baseViewport.height]);
          outPage.drawImage(image, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });
          const busyText = document.querySelector('#busyText, .busy-overlay strong, [data-busy-text]');
          if (busyText) busyText.textContent = `Convertendo para ${mode === 'bw' ? 'preto e branco' : 'tons de cinza'} • página ${pageCounter}/${totalPages}`;
          pdfPage.cleanup();
        }
      } finally { source.cleanup?.(); source.destroy?.(); }
    }
    canvas.width = 1; canvas.height = 1;
    return output.save({ useObjectStreams: true });
  }
  async function runMergeWithColor() {
    if (!state.mergeFiles || state.mergeFiles.length < 2) return toast('Adicione pelo menos dois PDFs para mesclar.', true);
    const mode = document.querySelector('#mergeColorMode')?.value || 'original';
    const quality = document.querySelector('#mergeMonoQuality')?.value || 'balanced';
    const threshold = Number(document.querySelector('#mergeThreshold')?.value || 185);
    setBusy(true, mode === 'original' ? 'Mesclando os PDFs...' : 'Convertendo e mesclando os PDFs...');
    try {
      const bytes = mode === 'original' ? await mergeOriginal(state.mergeFiles) : await mergeMonochrome(state.mergeFiles, mode, SCALE_BY_QUALITY[quality] || 1.65, threshold);
      const suffix = mode === 'bw' ? '-preto-e-branco' : mode === 'gray' ? '-tons-de-cinza' : '';
      downloadBytes(bytes, `pdfs-mesclados${suffix}.pdf`);
      toast(mode === 'original' ? 'PDFs mesclados com sucesso.' : `PDFs mesclados em ${mode === 'bw' ? 'preto e branco' : 'tons de cinza'}.`);
    } catch (error) { console.error(error); toast('Não foi possível converter e mesclar os arquivos.', true); }
    finally { setBusy(false); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUi); else installUi();
})();