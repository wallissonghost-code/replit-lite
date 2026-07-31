/* EdiçãoPDF hotfix: PDF final deve corresponder à prévia da chapa. */
(() => {
  const MM_TO_PT = 72 / 25.4;
  const SHEET = { width: 510, height: 388 };
  const AREA = { width: 445, height: 315, x: 32.5, y: 36.5 };
  const mmToPt = (mm) => mm * MM_TO_PT;

  function addFillOption() {
    if (document.querySelector('#pressFillLastSheet')) return;
    const quantityField = document.querySelector('#pressQuantity')?.closest('.field');
    if (!quantityField) return;
    quantityField.insertAdjacentHTML('afterend', `
      <div class="press-fill-last-wrap">
        <label class="check-field">
          <input type="checkbox" id="pressFillLastSheet" checked />
          <span>Preencher a última chapa inteira para o PDF ficar igual à prévia</span>
        </label>
        <small id="pressFillLastInfo"></small>
      </div>`);
    const style = document.createElement('style');
    style.textContent = `.press-fill-last-wrap{margin-top:8px;padding:10px 12px;border:1px solid rgba(34,197,94,.3);background:rgba(34,197,94,.08);border-radius:10px}.press-fill-last-wrap small{display:block;margin-top:5px;color:var(--muted,#8f98a8);font-size:11px;line-height:1.35}`;
    document.head.appendChild(style);
    document.querySelector('#pressFillLastSheet').addEventListener('change', updateFillInfo);
    document.querySelector('#pressQuantity')?.addEventListener('input', updateFillInfo);
    document.querySelector('#pressCalculate')?.addEventListener('click', () => setTimeout(updateFillInfo));
    setTimeout(updateFillInfo);
  }

  function updateFillInfo() {
    const info = document.querySelector('#pressFillLastInfo');
    const check = document.querySelector('#pressFillLastSheet');
    const config = globalThis.state?.pressSheet?.plan;
    if (!info || !check || !config) return;
    const requested = Math.max(1, Number(document.querySelector('#pressQuantity')?.value) || config.quantity || 1);
    const sheets = Math.ceil(requested / config.copiesPerSheet);
    const fullTotal = sheets * config.copiesPerSheet;
    const extra = Math.max(0, fullTotal - requested);
    info.textContent = check.checked
      ? extra
        ? `O PDF preencherá todos os espaços: ${fullTotal} artes no total (${extra} extra${extra === 1 ? '' : 's'}).`
        : `O PDF preencherá todos os ${config.copiesPerSheet} espaços da chapa.`
      : 'Desativado: a última chapa poderá sair incompleta conforme a quantidade informada.';
  }

  function uniqueSorted(values) {
    return [...new Set(values.map((value) => Number(value).toFixed(4)))].map(Number).sort((a, b) => a - b);
  }

  function gridBoundaries(config) {
    const xs = [];
    const ys = [];
    config.placements.forEach((placement) => {
      xs.push(placement.x, placement.x + placement.width);
      ys.push(placement.y, placement.y + placement.height);
    });
    return { xs: uniqueSorted(xs), ys: uniqueSorted(ys) };
  }

  function drawPdfGridMarks(page, config) {
    if (!config.cropMarks) return;
    const { rgb } = PDFLib;
    const { xs, ys } = gridBoundaries(config);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const thickness = 0.35;
    xs.forEach((x) => {
      page.drawLine({ start: { x: mmToPt(x), y: mmToPt(maxY + config.markOffset) }, end: { x: mmToPt(x), y: mmToPt(maxY + config.markOffset + config.markLength) }, thickness, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: mmToPt(x), y: mmToPt(minY - config.markOffset) }, end: { x: mmToPt(x), y: mmToPt(minY - config.markOffset - config.markLength) }, thickness, color: rgb(0, 0, 0) });
    });
    ys.forEach((y) => {
      page.drawLine({ start: { x: mmToPt(minX - config.markOffset), y: mmToPt(y) }, end: { x: mmToPt(minX - config.markOffset - config.markLength), y: mmToPt(y) }, thickness, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: mmToPt(maxX + config.markOffset), y: mmToPt(y) }, end: { x: mmToPt(maxX + config.markOffset + config.markLength), y: mmToPt(y) }, thickness, color: rgb(0, 0, 0) });
    });
  }

  function drawPdfRegistration(page, config) {
    if (!config.registration) return;
    const { rgb } = PDFLib;
    const positions = [[SHEET.width / 2, AREA.y / 2], [SHEET.width / 2, SHEET.height - AREA.y / 2]];
    positions.forEach(([x, y]) => {
      const radius = 4;
      page.drawCircle({ x: mmToPt(x), y: mmToPt(y), size: mmToPt(radius), borderWidth: 0.35, borderColor: rgb(0, 0, 0) });
      page.drawLine({ start: { x: mmToPt(x - radius * 1.5), y: mmToPt(y) }, end: { x: mmToPt(x + radius * 1.5), y: mmToPt(y) }, thickness: 0.35, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: mmToPt(x), y: mmToPt(y - radius * 1.5) }, end: { x: mmToPt(x), y: mmToPt(y + radius * 1.5) }, thickness: 0.35, color: rgb(0, 0, 0) });
    });
  }

  function drawAsset(page, asset, placement, config) {
    const { degrees } = PDFLib;
    const bleed = config.bleed;
    const box = {
      x: placement.x - bleed,
      y: placement.y - bleed,
      width: placement.width + bleed * 2,
      height: placement.height + bleed * 2,
    };
    const sourceWidth = state.pressSheet.sourceWidth;
    const sourceHeight = state.pressSheet.sourceHeight;
    const totalRotation = ((placement.rotated ? 90 : 0) + (placement.rotation180 || 0)) % 360;
    const quarterTurn = totalRotation === 90 || totalRotation === 270;
    let drawWidth = box.width;
    let drawHeight = box.height;
    let drawX = box.x;
    let drawY = box.y;
    if (config.fit !== 'stretch') {
      const effectiveWidth = quarterTurn ? sourceHeight : sourceWidth;
      const effectiveHeight = quarterTurn ? sourceWidth : sourceHeight;
      const scale = Math.min(box.width / effectiveWidth, box.height / effectiveHeight);
      drawWidth = effectiveWidth * scale;
      drawHeight = effectiveHeight * scale;
      drawX += (box.width - drawWidth) / 2;
      drawY += (box.height - drawHeight) / 2;
    }
    let options;
    if (totalRotation === 90) options = { x: mmToPt(drawX + drawWidth), y: mmToPt(drawY), width: mmToPt(drawHeight), height: mmToPt(drawWidth), rotate: degrees(90) };
    else if (totalRotation === 180) options = { x: mmToPt(drawX + drawWidth), y: mmToPt(drawY + drawHeight), width: mmToPt(drawWidth), height: mmToPt(drawHeight), rotate: degrees(180) };
    else if (totalRotation === 270) options = { x: mmToPt(drawX), y: mmToPt(drawY + drawHeight), width: mmToPt(drawHeight), height: mmToPt(drawWidth), rotate: degrees(270) };
    else options = { x: mmToPt(drawX), y: mmToPt(drawY), width: mmToPt(drawWidth), height: mmToPt(drawHeight) };
    if (asset.kind === 'pdf') page.drawPage(asset.value, options);
    else page.drawImage(asset.value, options);
  }

  async function generateFixedSheet() {
    if (!state.pressSheet.file) return toast('Selecione a arte da chapa.', true);
    const config = state.pressSheet.plan;
    if (!config) return toast('Calcule a montagem antes de gerar.', true);
    const fillLastSheet = document.querySelector('#pressFillLastSheet')?.checked !== false;
    setBusy(true, 'Montando a chapa completa...');
    try {
      const { PDFDocument, StandardFonts, rgb } = PDFLib;
      const output = await PDFDocument.create();
      let asset;
      if (state.pressSheet.kind === 'pdf') {
        const [embeddedPage] = await output.embedPdf(state.pressSheet.bytes, [0]);
        asset = { kind: 'pdf', value: embeddedPage };
      } else {
        const image = state.pressSheet.imageType === 'image/jpeg'
          ? await output.embedJpg(state.pressSheet.bytes)
          : await output.embedPng(state.pressSheet.bytes);
        asset = { kind: 'image', value: image };
      }
      const font = await output.embedFont(StandardFonts.Helvetica);
      let producedRequested = 0;
      for (let sheetIndex = 0; sheetIndex < config.sheets; sheetIndex += 1) {
        const outputPage = output.addPage([mmToPt(SHEET.width), mmToPt(SHEET.height)]);
        const remainingRequested = config.quantity - producedRequested;
        const copiesOnSheet = fillLastSheet
          ? config.copiesPerSheet
          : Math.min(config.copiesPerSheet, remainingRequested);
        config.placements.slice(0, copiesOnSheet).forEach((placement) => drawAsset(outputPage, asset, placement, config));
        drawPdfGridMarks(outputPage, config);
        drawPdfRegistration(outputPage, config);
        if (config.jobInfo) {
          const pairing = { normal: 'normal', feet: 'pe com pe', heads: 'cabeca com cabeca' }[config.pairingMode] || 'normal';
          const totalProduced = fillLastSheet ? config.sheets * config.copiesPerSheet : config.quantity;
          const info = `Chapa 510 x 388 mm | area 445 x 315 mm | ${config.columns}x${config.rows} | ${pairing} | total ${totalProduced} | folha ${sheetIndex + 1}/${config.sheets}`;
          outputPage.drawText(info, { x: mmToPt(10), y: mmToPt(8), size: 7, font, color: rgb(0, 0, 0) });
        }
        producedRequested += Math.min(config.copiesPerSheet, remainingRequested);
      }
      output.setTitle('Chapa 51x38,8 - EdiçãoPDF');
      output.setCreator('EdiçãoPDF - WD Tools');
      const bytes = await output.save({ useObjectStreams: true });
      downloadBytes(bytes, 'chapa-51x38-8.pdf');
      const totalProduced = fillLastSheet ? config.sheets * config.copiesPerSheet : config.quantity;
      const extras = Math.max(0, totalProduced - config.quantity);
      toast(extras
        ? `Chapa completa gerada com ${totalProduced} artes (${extras} extras).`
        : 'Chapa gerada igual à prévia.');
    } catch (error) {
      console.error(error);
      toast(error.message || 'Não foi possível gerar a chapa.', true);
    } finally {
      setBusy(false);
    }
  }

  function installFixedGenerator() {
    addFillOption();
    const oldButton = document.querySelector('#pressGenerate');
    if (!oldButton || oldButton.dataset.fullSheetFix === 'true') return;
    const newButton = oldButton.cloneNode(true);
    newButton.dataset.fullSheetFix = 'true';
    oldButton.replaceWith(newButton);
    newButton.addEventListener('click', generateFixedSheet);
    updateFillInfo();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installFixedGenerator);
  else installFixedGenerator();
})();
