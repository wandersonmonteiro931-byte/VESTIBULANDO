import { AlertCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FirebaseErrorScreenProps {
  error: Error;
}

export function FirebaseErrorScreen({ error }: FirebaseErrorScreenProps) {
  const isInvalidApiKey = error.message.includes("invalid-api-key");
  const isMissingCredentials = error.message.includes("missing");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <CardTitle>Erro de Configuração do Firebase</CardTitle>
              <CardDescription>
                {isInvalidApiKey && "As credenciais do Firebase são inválidas"}
                {isMissingCredentials && "As credenciais do Firebase estão faltando"}
                {!isInvalidApiKey && !isMissingCredentials && "Erro ao conectar com Firebase"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-md">
            <p className="text-sm font-mono text-muted-foreground">{error.message}</p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Como corrigir:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                Acesse o{" "}
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                  data-testid="link-firebase-console"
                >
                  Console do Firebase
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Crie um novo projeto ou selecione um existente</li>
              <li>Vá em Configurações do Projeto (ícone de engrenagem)</li>
              <li>Role até "Seus apps" e clique no ícone web (&lt;/&gt;)</li>
              <li>Copie as seguintes credenciais:</li>
            </ol>

            <div className="p-3 bg-muted rounded-md space-y-2 text-sm font-mono">
              <div>• VITE_FIREBASE_API_KEY</div>
              <div>• VITE_FIREBASE_PROJECT_ID</div>
              <div>• VITE_FIREBASE_APP_ID</div>
            </div>

            <ol start={6} className="list-decimal list-inside space-y-2 text-sm">
              <li>No Replit, adicione essas credenciais nos Secrets</li>
              <li>Recarregue a aplicação</li>
            </ol>
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.reload()}
              data-testid="button-reload"
            >
              Recarregar Aplicação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
