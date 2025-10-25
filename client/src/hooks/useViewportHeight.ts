import { useEffect } from 'react';

/**
 * Hook para gerenciar a altura real da viewport em dispositivos móveis
 * Resolve problemas com teclado virtual usando visualViewport API
 * 
 * Estratégia (baseada em solução robusta):
 * 1. Define --app-height com visualViewport.height (área visível)
 * 2. Calcula altura do teclado (window.innerHeight - visualViewport.height)
 * 3. Aplica transform no input wrapper para mover acima do teclado
 * 4. Ajusta paddingBottom das mensagens dinamicamente
 * 5. Usa scrollIntoView no último elemento
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

    // Use visualViewport quando disponível - mais preciso no mobile
    if (window.visualViewport) {
      const vv = window.visualViewport;

      const onViewportChange = () => {
        // vv.height é a área visível - exclui teclado
        const visibleH = Math.round(vv.height);
        
        // Calcular teclado aproximado
        const keyboardH = Math.round(window.innerHeight - visibleH);

        // Se teclado está aberto (diferença significativa), use visibleH
        // Senão, use window.innerHeight para evitar problemas em desktop
        if (keyboardH > 50) {
          setAppHeight(visibleH);
        } else {
          setAppHeight(window.innerHeight);
        }

        // Disparar evento customizado com a altura do teclado
        // Componentes podem ouvir isso para ajustar layout
        const event = new CustomEvent('viewport-keyboard-change', {
          detail: { keyboardHeight: keyboardH > 50 ? keyboardH : 0, visibleHeight: visibleH }
        });
        window.dispatchEvent(event);
      };

      vv.addEventListener('resize', onViewportChange);
      vv.addEventListener('scroll', onViewportChange);
      
      // Inicializar
      onViewportChange();

      // Orientação
      const handleOrientation = () => {
        setTimeout(() => setAppHeight(window.innerHeight), 300);
      };
      window.addEventListener('orientationchange', handleOrientation);

      return () => {
        vv.removeEventListener('resize', onViewportChange);
        vv.removeEventListener('scroll', onViewportChange);
        window.removeEventListener('orientationchange', handleOrientation);
      };
    } else {
      // Fallback: resize
      const handleResize = () => {
        setTimeout(() => setAppHeight(window.innerHeight), 50);
      };
      window.addEventListener('resize', handleResize);

      const handleLoad = () => setAppHeight(window.innerHeight);
      window.addEventListener('load', handleLoad);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('load', handleLoad);
      };
    }
  }, []);
}
