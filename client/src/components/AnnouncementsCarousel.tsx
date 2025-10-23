import { useState, useEffect } from "react";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { where } from "firebase/firestore";
import type { Announcement, AnnouncementSlide } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AnnouncementsCarouselProps {
  userType: "aluno" | "professor";
  userTurma?: string;
}

export function AnnouncementsCarousel({ userType, userTurma }: AnnouncementsCarouselProps) {
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const { data: announcements, isLoading } = useRealtimeQuery<Announcement>({
    collectionName: "announcements",
    queryKey: ["/api/announcements", userType, userTurma],
    constraints: [where("ativo", "==", true)],
    transform: (docs) => docs as Announcement[],
  });

  // Filtrar avisos baseado no público-alvo
  const filteredAnnouncements = announcements?.filter((announcement) => {
    // "todos" mostra para todos
    if (announcement.publicoAlvo === "todos") {
      return true;
    }
    // Mostrar para alunos ou professores específicos
    if (announcement.publicoAlvo === userType + "s") {
      return true;
    }
    // Mostrar para turmas específicas
    if (announcement.publicoAlvo === "turmas" && userTurma) {
      return announcement.turmasSelecionadas?.includes(userTurma);
    }
    return false;
  });

  // Resetar índices quando a lista de avisos filtrados mudar (para evitar índices inválidos)
  useEffect(() => {
    if (!filteredAnnouncements || filteredAnnouncements.length === 0) {
      setCurrentAnnouncementIndex(0);
      setCurrentSlideIndex(0);
      return;
    }

    // Se o índice atual está fora dos limites, resetar
    if (currentAnnouncementIndex >= filteredAnnouncements.length) {
      setCurrentAnnouncementIndex(0);
      setCurrentSlideIndex(0);
      return;
    }

    // Se o slide atual está fora dos limites do aviso atual, resetar
    const currentAnnouncement = filteredAnnouncements[currentAnnouncementIndex];
    if (currentAnnouncement && currentSlideIndex >= currentAnnouncement.slides.length) {
      setCurrentSlideIndex(0);
    }
  }, [filteredAnnouncements]);

  // Auto-avançar slides a cada 10 segundos
  useEffect(() => {
    if (!filteredAnnouncements || filteredAnnouncements.length === 0) return;

    const currentAnnouncement = filteredAnnouncements[currentAnnouncementIndex];
    if (!currentAnnouncement || !currentAnnouncement.slides) return;

    const interval = setInterval(() => {
      // Se há mais slides no aviso atual, avançar para o próximo slide
      if (currentSlideIndex < currentAnnouncement.slides.length - 1) {
        setCurrentSlideIndex(currentSlideIndex + 1);
      } else {
        // Se acabaram os slides, ir para o próximo aviso
        if (currentAnnouncementIndex < filteredAnnouncements.length - 1) {
          setCurrentAnnouncementIndex(currentAnnouncementIndex + 1);
          setCurrentSlideIndex(0);
        } else {
          // Se acabaram os avisos, voltar ao início
          setCurrentAnnouncementIndex(0);
          setCurrentSlideIndex(0);
        }
      }
    }, 10000); // 10 segundos

    return () => clearInterval(interval);
  }, [filteredAnnouncements, currentAnnouncementIndex, currentSlideIndex]);

  const handlePrevious = () => {
    if (!filteredAnnouncements || filteredAnnouncements.length === 0) return;
    
    const currentAnnouncement = filteredAnnouncements[currentAnnouncementIndex];
    
    // Se não é o primeiro slide, voltar um slide
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    } else {
      // Se é o primeiro slide, voltar para o aviso anterior (último slide)
      if (currentAnnouncementIndex > 0) {
        const prevAnnouncement = filteredAnnouncements[currentAnnouncementIndex - 1];
        setCurrentAnnouncementIndex(currentAnnouncementIndex - 1);
        setCurrentSlideIndex(prevAnnouncement.slides.length - 1);
      } else {
        // Se é o primeiro aviso, voltar para o último aviso (último slide)
        const lastAnnouncement = filteredAnnouncements[filteredAnnouncements.length - 1];
        setCurrentAnnouncementIndex(filteredAnnouncements.length - 1);
        setCurrentSlideIndex(lastAnnouncement.slides.length - 1);
      }
    }
  };

  const handleNext = () => {
    if (!filteredAnnouncements || filteredAnnouncements.length === 0) return;
    
    const currentAnnouncement = filteredAnnouncements[currentAnnouncementIndex];
    
    // Se não é o último slide, avançar um slide
    if (currentSlideIndex < currentAnnouncement.slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      // Se é o último slide, avançar para o próximo aviso (primeiro slide)
      if (currentAnnouncementIndex < filteredAnnouncements.length - 1) {
        setCurrentAnnouncementIndex(currentAnnouncementIndex + 1);
        setCurrentSlideIndex(0);
      } else {
        // Se é o último aviso, voltar ao primeiro aviso (primeiro slide)
        setCurrentAnnouncementIndex(0);
        setCurrentSlideIndex(0);
      }
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="announcements-carousel-loading">
        <CardContent className="p-0">
          <Skeleton className="w-full aspect-video" />
        </CardContent>
      </Card>
    );
  }

  if (!filteredAnnouncements || filteredAnnouncements.length === 0) {
    return null;
  }

  const currentAnnouncement = filteredAnnouncements[currentAnnouncementIndex];
  
  // Guarda defensiva: se não há aviso atual ou slides, não renderizar
  if (!currentAnnouncement || !currentAnnouncement.slides || currentAnnouncement.slides.length === 0) {
    return null;
  }
  
  const currentSlide = currentAnnouncement.slides[currentSlideIndex];
  
  // Guarda defensiva: se não há slide atual, não renderizar
  if (!currentSlide) {
    return null;
  }
  
  // Calcular total de slides em todos os avisos
  const totalSlides = filteredAnnouncements.reduce((acc, ann) => acc + ann.slides.length, 0);
  const hasMultipleSlides = totalSlides > 1;

  return (
    <Card data-testid="announcements-carousel">
      <CardContent className="p-0">
        <div className="relative">
          {/* Container padrão para avisos */}
          <div className="w-full h-80 bg-muted/30 overflow-hidden rounded-lg">
            {currentSlide.tipo === "texto" ? (
              <div className="w-full h-full flex items-center justify-center p-8">
                <div className="max-w-5xl mx-auto text-center space-y-4">
                  <div className="flex justify-center mb-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Megaphone className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  {currentAnnouncement.titulo && (
                    <h3 className="text-2xl font-bold mb-4" data-testid="announcement-title">
                      {currentAnnouncement.titulo}
                    </h3>
                  )}
                  <p className="text-base md:text-lg whitespace-pre-wrap leading-relaxed">
                    {currentSlide.conteudo}
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted/50">
                <img
                  src={currentSlide.conteudo}
                  alt={currentAnnouncement.titulo || "Aviso"}
                  className="w-full h-full object-contain"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                  data-testid="announcement-image"
                />
              </div>
            )}
          </div>

          {/* Controles de navegação */}
          {hasMultipleSlides && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                onClick={handlePrevious}
                data-testid="button-carousel-previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                onClick={handleNext}
                data-testid="button-carousel-next"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>

              {/* Indicadores de slide */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {filteredAnnouncements.map((announcement, annIndex) =>
                  announcement.slides.map((_, slideIndex) => {
                    const isActive = annIndex === currentAnnouncementIndex && slideIndex === currentSlideIndex;
                    return (
                      <button
                        key={`${annIndex}-${slideIndex}`}
                        className={`h-2 rounded-full transition-all ${
                          isActive
                            ? "w-8 bg-primary"
                            : "w-2 bg-primary/30 hover:bg-primary/50"
                        }`}
                        onClick={() => {
                          setCurrentAnnouncementIndex(annIndex);
                          setCurrentSlideIndex(slideIndex);
                        }}
                        data-testid={`carousel-indicator-${annIndex}-${slideIndex}`}
                      />
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
