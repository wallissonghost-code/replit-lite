/* EdiçãoPDF hotfix — preservar TODAS as páginas dos DOCX. */
(() => {
  const wrap = (library) => {
    if (!library?.renderAsync || library.__edicaoPdfAllPagesFix) return library;
    const original = library.renderAsync.bind(library);
    library.renderAsync = (data, bodyContainer, styleContainer, options = {}) => original(
      data,
      bodyContainer,
      styleContainer,
      {
        ...options,
        breakPages: true,
        ignoreLastRenderedPageBreak: false,
        ignoreHeight: false,
        renderHeaders: true,
        renderFooters: true,
      },
    );
    Object.defineProperty(library, '__edicaoPdfAllPagesFix', { value: true });
    return library;
  };

  let stored = wrap(globalThis.docx);
  try {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'docx');
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(globalThis, 'docx', {
        configurable: true,
        enumerable: true,
        get() { return stored; },
        set(value) { stored = wrap(value); },
      });
    }
  } catch (error) {
    console.warn('EdiçãoPDF: não foi possível instalar o interceptador DOCX imediatamente.', error);
  }

  const timer = setInterval(() => {
    if (globalThis.docx?.renderAsync) {
      const fixed = wrap(globalThis.docx);
      if (fixed !== globalThis.docx) globalThis.docx = fixed;
      if (globalThis.docx?.__edicaoPdfAllPagesFix) clearInterval(timer);
    }
  }, 100);
  setTimeout(() => clearInterval(timer), 30000);
})();
