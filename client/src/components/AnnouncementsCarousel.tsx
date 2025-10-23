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
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: announcements, isLoading } = useRealtimeQuery<Announcement>({
    collectionName: "announcements",
    queryKey: ["/api/announcements", userType, userTurma],
    constraints: [where("ativo", "==", true)],
    transform: (docs) => docs as Announcement[],
  });

  const filteredAnnouncements = announcements?.filter((announcement) => {
    if (announcement.publicoAlvo === userType + "s") {
      return true;
    }
    if (announcement.publicoAlvo === "turmas" && userTurma) {
      return announcement.turmasSelecionadas?.includes(userTurma);
    }
    return false;
  });

  useEffect(() => {
    if (!filteredAnnouncements || filteredAnnouncements.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === filteredAnnouncements.length - 1 ? 0 : prevIndex + 1
      );
    }, 10000);

    return () => clearInterval(interval);
  }, [filteredAnnouncements]);

  const handlePrevious = () => {
    if (!filteredAnnouncements) return;
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? filteredAnnouncements.length - 1 : prevIndex - 1
    );
  };

  const handleNext = () => {
    if (!filteredAnnouncements) return;
    setCurrentIndex((prevIndex) =>
      prevIndex === filteredAnnouncements.length - 1 ? 0 : prevIndex + 1
    );
  };

  if (isLoading) {
    return (
      <Card data-testid="announcements-carousel-loading">
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!filteredAnnouncements || filteredAnnouncements.length === 0) {
    return null;
  }

  const currentAnnouncement = filteredAnnouncements[currentIndex];

  return (
    <Card data-testid="announcements-carousel">
      <CardContent className="p-0">
        <div className="relative">
          <div className="overflow-hidden bg-muted/30">
            {currentAnnouncement.tipo === "texto" ? (
              <div className="p-8 min-h-[200px] flex items-center justify-center">
                <div className="max-w-3xl mx-auto text-center space-y-3">
                  <div className="flex justify-center mb-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Megaphone className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <p className="text-base md:text-lg whitespace-pre-wrap leading-relaxed">
                    {currentAnnouncement.conteudo}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center bg-muted/50 p-4">
                <img
                  src={currentAnnouncement.conteudo}
                  alt="Aviso"
                  className="w-full max-w-4xl h-auto object-contain rounded-lg"
                  style={{ 
                    maxHeight: "500px",
                    aspectRatio: "16/9"
                  }}
                  data-testid="announcement-image"
                />
              </div>
            )}
          </div>

          {filteredAnnouncements.length > 1 && (
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

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {filteredAnnouncements.map((_, index) => (
                  <button
                    key={index}
                    className={`h-2 rounded-full transition-all ${
                      index === currentIndex
                        ? "w-8 bg-primary"
                        : "w-2 bg-primary/30 hover:bg-primary/50"
                    }`}
                    onClick={() => setCurrentIndex(index)}
                    data-testid={`carousel-indicator-${index}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
