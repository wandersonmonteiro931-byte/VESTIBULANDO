import { useEffect } from 'react';

/**
 * Hook para gerenciar a altura real da viewport em dispositivos móveis
 * Resolve problemas com teclado virtual (100vh vs altura real)
 * 
 * Estratégia:
 * 1. Define variável CSS --app-height com window.innerHeight (valor real)
 * 2. Atualiza quando teclado abre/fecha usando visualViewport API
 * 3. Fallback para eventos resize em navegadores antigos
 */
export function useViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;

    function setAppHeight(height?: number) {
      const h = height || window.innerHeight;
      root.style.setProperty('--app-height', `${h}px`);
    }

    // Altura inicial
    setAppHeight();

    // 1) Ajusta quando a janela redimensiona (Chrome Android, desktop)
    const handleResize = () => {
      setTimeout(() => setAppHeight(window.innerHeight), 50);
    };
    window.addEventListener('resize', handleResize);

    // 2) Use visualViewport quando disponível - mais preciso no mobile
    let visualViewportResize: (() => void) | undefined;
    let visualViewportScroll: (() => void) | undefined;

    if (window.visualViewport) {
      const onVVResize = () => {
        // Altura visível da viewport (exclui teclado)
        const vvHeight = window.visualViewport!.height;
        root.style.setProperty('--app-height', `${vvHeight}px`);
      };

      visualViewportResize = onVVResize;
      visualViewportScroll = onVVResize;

      window.visualViewport.addEventListener('resize', onVVResize);
      window.visualViewport.addEventListener('scroll', onVVResize);
    }

    // 3) Definir altura inicial quando página carrega
    const handleLoad = () => setAppHeight(window.innerHeight);
    window.addEventListener('load', handleLoad);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('load', handleLoad);
      
      if (window.visualViewport && visualViewportResize && visualViewportScroll) {
        window.visualViewport.removeEventListener('resize', visualViewportResize);
        window.visualViewport.removeEventListener('scroll', visualViewportScroll);
      }
    };
  }, []);
}
