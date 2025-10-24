import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";

interface ChatTermsModalProps {
  open: boolean;
  onAccept: () => void;
}

export function ChatTermsModal({ open, onAccept }: ChatTermsModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = () => {
    if (agreedToTerms && hasScrolledToBottom) {
      onAccept();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl max-h-[90vh]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Termos de Uso e Regras do Chat
          </DialogTitle>
          <DialogDescription>
            Por favor, leia atentamente antes de utilizar o chat da plataforma
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4" onScrollCapture={handleScroll}>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-bold text-base mb-2">📜 TERMOS DE USO E REGRAS DO CHAT</h3>
              <p className="text-muted-foreground">Plataforma Preparatório Vestibulando</p>
            </div>

            <div>
              <h4 className="font-bold mb-2">🔷 1. OBJETIVO DO CHAT</h4>
              <p className="leading-relaxed">
                O sistema de mensagens ("Chat Vestibulando") é um ambiente interno de comunicação disponibilizado pela plataforma Vestibulando, destinado a promover interação entre alunos, professores e a Diretoria.
              </p>
              <p className="leading-relaxed mt-2">
                O objetivo é facilitar o diálogo acadêmico, o suporte pedagógico e a troca de informações administrativas em um ambiente seguro, respeitoso e monitorado.
              </p>
              <p className="leading-relaxed mt-2">
                Este canal não deve ser utilizado para conversas pessoais, conteúdos alheios à rotina escolar ou qualquer prática que comprometa a integridade, privacidade e harmonia da comunidade educacional.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-2">🔷 2. REGRAS GERAIS DE UTILIZAÇÃO</h4>
              <p className="leading-relaxed mb-2">
                Ao utilizar o chat, o usuário declara estar ciente e de acordo com as seguintes regras:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>O chat é de uso exclusivo para assuntos acadêmicos e administrativos da plataforma.</li>
                <li>É proibido o envio de qualquer tipo de conteúdo:
                  <ul className="list-circle pl-6 mt-1 space-y-1">
                    <li>Ofensivo, agressivo ou ameaçador;</li>
                    <li>Discriminatório (de natureza racial, religiosa, sexual, política ou social);</li>
                    <li>Pornográfico, violento ou impróprio;</li>
                    <li>Falso (fake news), fraudulento ou que possa causar danos à reputação de outros.</li>
                  </ul>
                </li>
                <li>É proibido o compartilhamento de links externos suspeitos, arquivos maliciosos, spam ou mensagens em massa.</li>
                <li>Todas as conversas, áudios, imagens e documentos são monitorados e armazenados pela Diretoria para fins de auditoria, segurança e controle disciplinar.</li>
                <li>O usuário deve manter conduta ética, respeitosa e colaborativa em todas as interações.</li>
                <li>A criação de grupos, canais ou conversas em massa não autorizadas pela Diretoria é estritamente proibida.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-2">🔷 3. TIPOS DE MENSAGENS E ARQUIVOS PERMITIDOS</h4>
              <p className="leading-relaxed mb-2">
                O chat permite o envio e recebimento dos seguintes tipos de conteúdo:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>💬 Mensagens de texto</li>
                <li>🎙️ Áudios (mensagens de voz)</li>
                <li>🖼️ Imagens (JPG, PNG, etc.)</li>
                <li>📄 Documentos (PDF, Word, Excel, PowerPoint, etc.)</li>
                <li>🎬 Vídeos e músicas apenas se relacionados a atividades pedagógicas</li>
              </ul>
              <p className="leading-relaxed mt-2">
                Todos os arquivos enviados devem respeitar as normas de conduta e estar sujeitos à verificação pela Diretoria.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-2">🔷 4. HISTÓRICO E AUDITORIA</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li>Todo o histórico de mensagens é armazenado integralmente, sem limite de tempo.</li>
                <li>Caso o usuário apague uma conversa ou mensagem, a exclusão será apenas local (visível apenas para ele).</li>
                <li>O registro completo permanecerá salvo na auditoria da Diretoria, contendo data, hora, remetente e destinatário.</li>
                <li>Nenhum dado poderá ser permanentemente excluído do sistema sem autorização expressa da Diretoria.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-2">🔷 5. CHAT DA DIRETORIA</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li>O chat institucional da Diretoria será exibido apenas como "Diretoria", sem identificação pessoal.</li>
                <li>É um canal oficial de comunicação, orientações e acompanhamento disciplinar.</li>
                <li>A Diretoria possui acesso total a todos os registros de conversas e arquivos, inclusive os apagados pelos usuários.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-2">🔷 6. BLOQUEIO DE CHAT PELA DIRETORIA</h4>
              <p className="leading-relaxed mb-2">
                A Diretoria possui poder administrativo integral sobre o módulo de chat e poderá bloquear o acesso total ou parcial a qualquer momento, conforme necessidade institucional.
              </p>
              
              <p className="font-semibold mt-3">🔒 6.1. BLOQUEIO GERAL DO CHAT</p>
              <p className="leading-relaxed mt-1">
                A Diretoria poderá, por meio do painel administrativo, bloquear o chat de todos os usuários.
              </p>
              <p className="leading-relaxed mt-2">Durante o bloqueio:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>O ícone do chat continuará visível;</li>
                <li>Ao clicar, será exibido um aviso de bloqueio temporário, com o motivo, a previsão de retorno e uma mensagem institucional explicativa.</li>
              </ul>
              <p className="leading-relaxed mt-2">🧾 Motivos pré-definidos:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>Auditoria</li>
                <li>Prova/Avaliação em andamento</li>
                <li>Manutenção técnica</li>
                <li>Atividade avaliativa sem consulta</li>
                <li>Recurso necessário para atividade acadêmica específica</li>
                <li>Penalidade disciplinar</li>
                <li>Outros motivos administrativos</li>
              </ul>

              <p className="font-semibold mt-3">🔧 6.2. BLOQUEIO SELETIVO</p>
              <p className="leading-relaxed mt-1">
                A Diretoria poderá bloquear o chat individualmente, atingindo alunos, professores ou turmas específicas. Durante o bloqueio, o usuário verá o aviso correspondente com o motivo e a previsão de liberação.
              </p>

              <p className="font-semibold mt-3">🔁 6.3. DESBLOQUEIO</p>
              <p className="leading-relaxed mt-1">Após o desbloqueio:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>Todas as conversas são reativadas automaticamente;</li>
                <li>O histórico completo é restaurado;</li>
                <li>Nenhum dado é perdido.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-2">🔷 7. RESPONSABILIDADE DO USUÁRIO</h4>
              <p className="leading-relaxed mb-2">Ao utilizar o chat, o usuário:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Assume responsabilidade total pelo conteúdo que envia;</li>
                <li>Reconhece que todo o material compartilhado pode ser utilizado em investigações administrativas ou legais;</li>
                <li>Compromete-se a respeitar as regras institucionais, professores e colegas;</li>
                <li>Está ciente de que mensagens ofensivas, caluniosas, discriminatórias ou ameaçadoras configuram infrações previstas em lei.</li>
              </ul>

              <p className="font-semibold mt-3">📚 Referências legais aplicáveis:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Constituição Federal (art. 5º, incisos IV, IX e X)</strong> – Garante a liberdade de expressão, mas proíbe abusos, ofensas e ataques à honra e imagem de terceiros.</li>
                <li><strong>Código Penal Brasileiro (Decreto-Lei nº 2.848/1940):</strong>
                  <ul className="list-circle pl-6 mt-1 space-y-1">
                    <li>Art. 138 – Calúnia</li>
                    <li>Art. 139 – Difamação</li>
                    <li>Art. 140 – Injúria</li>
                    <li>Art. 147 – Ameaça</li>
                  </ul>
                  <p className="mt-1">Tais crimes podem resultar em penas de detenção e multa, conforme sua gravidade.</p>
                </li>
                <li><strong>Marco Civil da Internet (Lei nº 12.965/2014)</strong>: Estabelece a responsabilidade do usuário por atos praticados em meio digital.</li>
                <li><strong>Lei nº 13.185/2015 (Programa de Combate à Intimidação Sistemática – "Lei do Bullying")</strong>: prevê medidas disciplinares e legais contra intimidações no ambiente escolar, inclusive virtuais.</li>
                <li><strong>Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018)</strong>: garante o tratamento responsável das informações pessoais e institui regras sobre segurança e privacidade digital.</li>
              </ul>

              <p className="leading-relaxed mt-3">
                🚨 Caso qualquer usuário pratique ofensas, ameaças, difamações, preconceito ou assédio virtual, a Diretoria poderá:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Aplicar sanções administrativas imediatas (advertência, suspensão, bloqueio de acesso);</li>
                <li>Registrar ocorrência disciplinar interna;</li>
                <li>Encaminhar o caso às autoridades competentes (Ministério Público, Delegacia de Crimes Cibernéticos ou Conselho Tutelar, quando aplicável).</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-2">🔷 8. PENALIDADES</h4>
              <p className="leading-relaxed mb-2">O descumprimento destes termos pode resultar em:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Advertência;</li>
                <li>Suspensão do chat;</li>
                <li>Bloqueio total do sistema;</li>
                <li>Encaminhamento para medidas legais cabíveis.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-2">🔷 9. SEGURANÇA E PRIVACIDADE</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li>Todas as comunicações são criptografadas e armazenadas de forma segura.</li>
                <li>Nenhum dado é compartilhado com terceiros sem autorização.</li>
                <li>A plataforma atua conforme a LGPD (Lei nº 13.709/2018).</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-2">🔷 10. DISPOSIÇÕES FINAIS</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li>O uso do chat implica aceitação plena e irrevogável destes termos.</li>
                <li>A plataforma reserva-se o direito de atualizar este documento a qualquer momento, com aviso prévio aos usuários.</li>
                <li>Em caso de dúvidas, o usuário deve contatar a Diretoria Vestibulando pelos canais oficiais de suporte.</li>
              </ul>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-muted-foreground">
                📘 Preparatório Vestibulando — Diretoria e Administração do Sistema
              </p>
              <p className="text-sm text-muted-foreground">
                Versão dos Termos: 1.1
              </p>
              <p className="text-sm text-muted-foreground">
                Última atualização: 10/2025
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-col gap-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="terms-agreement"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              disabled={!hasScrolledToBottom}
              data-testid="checkbox-terms-agreement"
            />
            <label
              htmlFor="terms-agreement"
              className={`text-sm leading-relaxed ${!hasScrolledToBottom ? "text-muted-foreground" : "cursor-pointer"}`}
            >
              Li e concordo com os Termos de Uso e Regras do Chat da Plataforma Vestibulando. 
              Estou ciente de que toda comunicação é monitorada e que condutas inadequadas podem resultar em penalidades.
            </label>
          </div>
          
          {!hasScrolledToBottom && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              ⚠️ Por favor, role até o final do documento para continuar
            </p>
          )}
          
          <Button
            onClick={handleAccept}
            disabled={!agreedToTerms || !hasScrolledToBottom}
            className="w-full"
            data-testid="button-accept-terms"
          >
            ACEITO OS TERMOS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
