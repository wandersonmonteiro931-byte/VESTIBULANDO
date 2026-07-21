import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileText, Loader2, ShieldCheck } from "lucide-react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { readFileFromFirestore, type FirestoreFileMetadata } from "@/lib/firestoreFileStore";

export default function FirestoreFilePage() {
  const [, params] = useRoute("/arquivo/:fileId");
  const [metadata, setMetadata] = useState<FirestoreFileMetadata | null>(null);
  const [objectUrl, setObjectUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let generatedUrl = "";
    const load = async () => {
      try {
        if (!params?.fileId) throw new Error("Referência de arquivo ausente.");
        const result = await readFileFromFirestore(params.fileId);
        if (!active) return;
        generatedUrl = URL.createObjectURL(result.blob);
        setMetadata(result.metadata);
        setObjectUrl(generatedUrl);
      } catch (reason: any) {
        if (active) setError(reason?.message || "Não foi possível abrir o arquivo.");
      }
    };
    void load();
    return () => { active = false; if (generatedUrl) URL.revokeObjectURL(generatedUrl); };
  }, [params?.fileId]);

  const close = () => {
    if (window.opener) window.close();
    else window.history.back();
  };
  const mime = metadata?.type || "";

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <section className="mx-auto max-w-5xl rounded-xl border bg-background shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex min-w-0 items-center gap-3"><FileText className="h-6 w-6 shrink-0 text-primary" /><span className="min-w-0"><strong className="block truncate">{metadata?.name || "Arquivo protegido"}</strong><small className="flex items-center gap-1 text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Armazenado no banco escolar, sem Firebase Storage</small></span></div>
          <div className="flex gap-2"><Button variant="outline" onClick={close}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>{objectUrl && metadata && <Button asChild><a href={objectUrl} download={metadata.name}><Download className="mr-2 h-4 w-4" />Baixar</a></Button>}</div>
        </header>
        <div className="min-h-[65vh] p-4">
          {!objectUrl && !error && <div className="flex min-h-[55vh] items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Conferindo acesso e integridade...</div>}
          {error && <div className="flex min-h-[55vh] items-center justify-center text-center"><div><FileText className="mx-auto mb-3 h-10 w-10 text-destructive" /><h1 className="text-lg font-semibold">Arquivo indisponível</h1><p className="mt-1 text-muted-foreground">{error}</p></div></div>}
          {objectUrl && mime.startsWith("image/") && <img src={objectUrl} alt={metadata?.name || "Arquivo"} className="mx-auto max-h-[72vh] max-w-full rounded object-contain" />}
          {objectUrl && mime === "application/pdf" && <iframe src={objectUrl} title={metadata?.name || "PDF"} className="h-[72vh] w-full rounded border" />}
          {objectUrl && mime.startsWith("audio/") && <div className="flex min-h-[55vh] items-center justify-center"><audio src={objectUrl} controls className="w-full max-w-2xl" /></div>}
          {objectUrl && mime.startsWith("video/") && <video src={objectUrl} controls className="mx-auto max-h-[72vh] max-w-full rounded" />}
          {objectUrl && !mime.startsWith("image/") && mime !== "application/pdf" && !mime.startsWith("audio/") && !mime.startsWith("video/") && <div className="flex min-h-[55vh] items-center justify-center text-center"><div><FileText className="mx-auto mb-3 h-12 w-12 text-primary" /><h1 className="font-semibold">Arquivo pronto para download</h1><p className="mt-1 text-sm text-muted-foreground">A pré-visualização não está disponível para este formato.</p></div></div>}
        </div>
      </section>
    </main>
  );
}
