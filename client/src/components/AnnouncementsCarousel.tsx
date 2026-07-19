import { useState, useEffect } from "react";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { where } from "firebase/firestore";
import type { Announcement } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AnnouncementsCarouselProps {
  userType: "aluno" | "professor";
  userTurma?: string;
}

export function AnnouncementsCarousel({ userType, userTurma }: AnnouncementsCarouselProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  const { data: announcements, isLoading } = useRealtimeQuery<Announcement>({
    collectionName: "announcements",
    queryKey: ["/api/announcements", userType, userTurma],
    constraints: [where("ativo", "==", true)],
    transform: (docs) => docs as Announcement[],
  });

  // Mapeamento correto de tipos de usuário para público-alvo (plural e singular para compatibilidade)
  const userTypeToPublicoAlvo: Record<string, string[]> = {
    aluno: ["alunos", "aluno"],
    professor: ["professores", "professor"],
  };

  // Filtrar avisos baseado no público-alvo e verificar se não expirou
  const filteredAnnouncements = announcements?.filter((announcement) => {
    // Verificar se o aviso não expirou
    if (announcement.tipoDuracao === "determinada" && announcement.dataFim) {
      const now = new Date();
      const dataFim = new Date(announcement.dataFim);
      if (now > dataFim) {
        return false;
      }
    }

    // "todos" mostra para todos
    if (announcement.publicoAlvo === "todos") {
      return true;
    }
    
    // Mostrar para alunos ou professores específicos (com compatibilidade singular/plural)
    const validPublicos = userTypeToPublicoAlvo[userType] || [];
    if (validPublicos.includes(announcement.publicoAlvo)) {
      return true;
    }
    
    // Mostrar para turmas específicas
    if (announcement.publicoAlvo === "turmas" && userTurma) {
      const turmas = announcement.turmasSelecionadas || [];
      return turmas.includes(userTurma);
    }
    
    return false;
  });

  // Separar slides por tipo
  const imageSlides: Array<{ announcement: Announcement; slideIndex: number }> = [];
  const textSlides: Array<{ announcement: Announcement; slideIndex: number }> = [];

  filteredAnnouncements?.forEach((announcement) => {
    announcement.slides.forEach((slide, index) => {
      if (slide.tipo === "imagem") {
        imageSlides.push({ announcement, slideIndex: index });
      } else {
        textSlides.push({ announcement, slideIndex: index });
      }
    });
  });

  // Resetar índices quando o número de slides mudar (para evitar índices inválidos)
  useEffect(() => {
    if (imageSlides.length > 0 && currentImageIndex >= imageSlides.length) {
      setCurrentImageIndex(0);
    }
  }, [imageSlides.length, currentImageIndex]);

  useEffect(() => {
    if (textSlides.length > 0 && currentTextIndex >= textSlides.length) {
      setCurrentTextIndex(0);
    }
  }, [textSlides.length, currentTextIndex]);

  // Auto-avançar slides de imagem a cada 7 segundos
  useEffect(() => {
    if (imageSlides.length === 0) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % imageSlides.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [imageSlides.length]);

  // Auto-avançar slides de texto a cada 7 segundos
  useEffect(() => {
    if (textSlides.length === 0) return;

    const interval = setInterval(() => {
      setCurrentTextIndex((prev) => (prev + 1) % textSlides.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [textSlides.length]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="w-full h-64 rounded-lg" />
        <Skeleton className="w-full h-64 rounded-lg" />
      </div>
    );
  }

  if (imageSlides.length === 0 && textSlides.length === 0) {
    return null;
  }

  const currentImageSlide = imageSlides[currentImageIndex];
  const currentTextSlide = textSlides[currentTextIndex];

  return (
    <div className="announcements-modern flex flex-col gap-5 w-full" data-testid="announcements-carousel">
      {/* Avisos de imagem - Desktop: esquerda, Mobile: primeiro */}
      {imageSlides.length > 0 && currentImageSlide && (
        <Card className="announcement-modern-card announcement-modern-fullbleed">
          <CardContent className="p-0">
            <div className="relative">
              <div className="announcement-modern-media announcement-modern-image w-full overflow-hidden">
                <img
                  src={currentImageSlide.announcement.slides[currentImageSlide.slideIndex].conteudo}
                  alt={currentImageSlide.announcement.titulo || "Aviso"}
                  className="block w-full h-auto object-contain"
                  data-testid="announcement-image"
                />
              </div>
              {imageSlides.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                    onClick={() =>
                      setCurrentImageIndex((prev) => (prev - 1 + imageSlides.length) % imageSlides.length)
                    }
                    data-testid="button-carousel-previous"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                    onClick={() => setCurrentImageIndex((prev) => (prev + 1) % imageSlides.length)}
                    data-testid="button-carousel-next"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {imageSlides.map((_, index) => (
                      <button
                        key={index}
                        className={`h-2 rounded-full transition-all ${
                          index === currentImageIndex
                            ? "w-8 bg-primary"
                            : "w-2 bg-primary/30 hover:bg-primary/50"
                        }`}
                        onClick={() => setCurrentImageIndex(index)}
                        data-testid={`carousel-indicator-${index}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Avisos de texto - Desktop: direita, Mobile: segundo */}
      {textSlides.length > 0 && currentTextSlide && (
        <Card className="announcement-modern-card announcement-modern-fullbleed">
          <CardContent className="p-0">
            <div className="relative">
              <div className="announcement-modern-media announcement-modern-text w-full h-64 overflow-hidden flex items-center justify-center p-8">
                <div className="max-w-full mx-auto text-center space-y-3">
                  <div className="flex justify-center mb-2">
                    <div className="announcement-modern-icon">
                      <Megaphone className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  {currentTextSlide.announcement.titulo && (
                    <h3 className="text-lg font-bold mb-2" data-testid="announcement-title">
                      {currentTextSlide.announcement.titulo}
                    </h3>
                  )}
                  <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">
                    {currentTextSlide.announcement.slides[currentTextSlide.slideIndex].conteudo}
                  </p>
                </div>
              </div>
              {textSlides.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                    onClick={() =>
                      setCurrentTextIndex((prev) => (prev - 1 + textSlides.length) % textSlides.length)
                    }
                    data-testid="button-carousel-text-previous"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                    onClick={() => setCurrentTextIndex((prev) => (prev + 1) % textSlides.length)}
                    data-testid="button-carousel-text-next"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {textSlides.map((_, index) => (
                      <button
                        key={index}
                        className={`h-2 rounded-full transition-all ${
                          index === currentTextIndex
                            ? "w-8 bg-primary"
                            : "w-2 bg-primary/30 hover:bg-primary/50"
                        }`}
                        onClick={() => setCurrentTextIndex(index)}
                        data-testid={`carousel-text-indicator-${index}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
