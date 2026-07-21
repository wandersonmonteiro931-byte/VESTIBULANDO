import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { CheckCircle2, FileCheck2, Loader2, Search, ShieldAlert, XCircle } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PortalBrand } from "@/components/PortalBrand";
import { db } from "@/lib/firebase";

function validationId(code: string) {
  return code.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 180);
}

export default function DocumentValidationPage() {
  const [, params] = useRoute("/validar/:code?");
  const [, navigate] = useLocation();
  const [code, setCode] = useState(params?.code ? decodeURIComponent(params.code) : "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);

  const validate = async (value = code) => {
    const normalized = value.trim();
    if (!normalized) return;
    setLoading(true);
    setSearched(true);
    try {
      const snapshot = await getDoc(doc(db, "schoolDocumentValidations", validationId(normalized)));
      setResult(snapshot.exists() ? snapshot.data() : null);
      if (window.location.pathname !== `/validar/${encodeURIComponent(normalized)}`) navigate(`/validar/${encodeURIComponent(normalized)}`, { replace: true });
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (params?.code) validate(decodeURIComponent(params.code)); }, [params?.code]);

  return (
    <main className="school-validation-page">
      <header><PortalBrand compactLabel="Validação" /></header>
      <Card className="school-validation-card"><CardContent>
        <div className="school-validation-icon"><FileCheck2 className="h-8 w-8" /></div>
        <h1>Validar documento escolar</h1>
        <p>Digite o código impresso no documento para conferir sua autenticidade, situação e hash de integridade.</p>
        <form onSubmit={(event) => { event.preventDefault(); validate(); }} className="school-validation-form"><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ex.: VE-16-20260719-123000" aria-label="Código do documento" /><Button type="submit" disabled={loading || !code.trim()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Validar</Button></form>
        {searched && !loading && (result ? <section className={`school-validation-result ${result.valid ? "is-valid" : "is-invalid"}`}>{result.valid ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}<div><h2>{result.valid ? "Documento autêntico" : "Documento cancelado ou inválido"}</h2><dl><div><dt>Código</dt><dd>{result.code}</dd></div><div><dt>Tipo</dt><dd>{result.documentType}</dd></div><div><dt>Titular</dt><dd>{result.holder}</dd></div><div><dt>Emissão</dt><dd>{new Date(result.issuedAt).toLocaleString("pt-BR")}</dd></div><div><dt>Situação</dt><dd>{result.status}</dd></div><div><dt>Hash SHA-256</dt><dd className="school-validation-hash">{result.integrityHash}</dd></div></dl></div></section> : <section className="school-validation-result is-invalid"><ShieldAlert className="h-7 w-7" /><div><h2>Código não localizado</h2><p>Confira a digitação ou entre em contato com a secretaria.</p></div></section>)}
      </CardContent></Card>
    </main>
  );
}
