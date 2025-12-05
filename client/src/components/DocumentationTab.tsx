import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, FileText, Download, User as UserIcon, GraduationCap, BookOpen, Calendar, Phone, MapPin, Clock } from "lucide-react";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useAuth } from "@/contexts/AuthContext";
import type { User, LoginHistory, Tarefa, Entrega, DisciplinaryAction, BoletimDocumento, Boletim } from "@shared/schema";
import { formatNota } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@assets/Blue and White Online School Logo (1)_1761189954480.png";
import assinaturaUrl from "@assets/image_1761190362373.png";
import assinaturaDeclaracaoUrl from "@assets/image_1761193127347.png";

export function DocumentationTab() {
  const { userData: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const { data: users, isLoading } = useRealtimeQuery<User>({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios/documentation"],
  });

  const { data: loginHistoryData } = useRealtimeQuery<LoginHistory>({
    collectionName: "loginHistory",
    queryKey: ["/api/loginHistory/all"],
  });

  const { data: tarefas } = useRealtimeQuery<Tarefa>({
    collectionName: "tarefas",
    queryKey: ["/api/tarefas/all"],
  });

  const { data: entregas } = useRealtimeQuery<Entrega>({
    collectionName: "entregas",
    queryKey: ["/api/entregas/all"],
  });

  const { data: disciplinaryActions } = useRealtimeQuery<DisciplinaryAction>({
    collectionName: "disciplinaryActions",
    queryKey: ["/api/disciplinaryActions/all"],
  });

  const { data: boletimDocumentos } = useRealtimeQuery<BoletimDocumento>({
    collectionName: "boletimDocumentos",
    queryKey: ["/api/boletim-documentos"],
  });

  const { data: boletins } = useRealtimeQuery<Boletim>({
    collectionName: "boletins",
    queryKey: ["/api/boletins"],
  });

  // Função para converter para horário de Brasília
  const formatBrasiliaTime = (isoString: string | undefined) => {
    if (!isoString) return "N/A";
    
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(date);
    } catch {
      return "Data inválida";
    }
  };

  // Filtrar usuários
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    
    let filtered = users.filter(user => 
      user.status === "aprovado" && 
      user.tipo !== "diretor" // Não mostrar diretores
    );

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.nome.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.matricula && user.matricula.includes(query))
      );
    }

    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [users, searchQuery]);

  // Dados do usuário selecionado
  const userHistory = useMemo(() => {
    if (!selectedUser || !loginHistoryData) return [];
    return loginHistoryData
      .filter(h => h.userId === selectedUser.uid)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [selectedUser, loginHistoryData]);

  const userEntregas = useMemo(() => {
    if (!selectedUser || !entregas) return [];
    return entregas.filter(e => e.alunoId === selectedUser.uid);
  }, [selectedUser, entregas]);

  const userDisciplinary = useMemo(() => {
    if (!selectedUser || !disciplinaryActions) return [];
    return disciplinaryActions.filter(d => d.alunoId === selectedUser.uid);
  }, [selectedUser, disciplinaryActions]);

  const userBoletimDocumentos = useMemo(() => {
    if (!selectedUser || !boletimDocumentos) return [];
    return boletimDocumentos
      .filter(b => b.alunoId === selectedUser.uid)
      .sort((a, b) => b.anoLetivo.localeCompare(a.anoLetivo));
  }, [selectedUser, boletimDocumentos]);

  const userBoletinsLiberados = useMemo(() => {
    if (!selectedUser || !boletins) return [];
    return boletins
      .filter(b => b.alunoId === selectedUser.uid && b.liberado)
      .sort((a, b) => b.anoLetivo.localeCompare(a.anoLetivo));
  }, [selectedUser, boletins]);

  // Verificar se pode ver a foto
  const canViewPhoto = (user: User) => {
    if (!user.fotoUrl && !user.fotoBase64) return false;
    if (user.fotoPublica) return true;
    return currentUser?.tipo === "diretor";
  };

  // Converter URL para base64 para uso em PDF
  const getPhotoBase64 = async (user: User): Promise<string | null> => {
    if (user.fotoBase64) {
      return user.fotoBase64;
    }
    
    if (user.fotoUrl) {
      try {
        const response = await fetch(user.fotoUrl);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error("Erro ao converter foto URL para base64:", error);
        return null;
      }
    }
    
    return null;
  };

  // Gerar PDF
  const generatePDF = async () => {
    if (!selectedUser) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let yPos = 15;

    // Quadrado para foto 3x4 do aluno no topo direito (ao lado do logo)
    const fotoX = pageWidth - margin - 30;
    const fotoY = 15; // Mesma altura do logo
    const fotoWidth = 25;
    const fotoHeight = 33;

    // Adicionar logo da escola no topo
    try {
      const logoImg = new Image();
      logoImg.src = logoUrl;
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve;
      });
      doc.addImage(logoImg, "PNG", pageWidth / 2 - 30, yPos, 60, 20);
      yPos += 25;
    } catch (error) {
      console.error("Erro ao carregar logo:", error);
      yPos += 5;
    }

    // Título do documento
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("DOCUMENTAÇÃO DO ALUNO", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;
    
    // Desenhar borda do quadrado da foto
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.rect(fotoX, fotoY, fotoWidth, fotoHeight);
    
    // Adicionar foto se existir
    if (canViewPhoto(selectedUser)) {
      const photoBase64 = await getPhotoBase64(selectedUser);
      if (photoBase64) {
        try {
          // Detectar formato da imagem (PNG ou JPEG)
          let imageFormat = "JPEG";
          if (photoBase64.startsWith("data:image/png")) {
            imageFormat = "PNG";
          } else if (photoBase64.startsWith("data:image/jpeg") || photoBase64.startsWith("data:image/jpg")) {
            imageFormat = "JPEG";
          }
          doc.addImage(photoBase64, imageFormat, fotoX, fotoY, fotoWidth, fotoHeight);
        } catch (error) {
          console.error("Erro ao adicionar foto:", error);
          // Mostrar texto "SEM FOTO" dentro do quadrado se houver erro
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text("SEM FOTO", fotoX + fotoWidth / 2, fotoY + fotoHeight / 2, { align: "center" });
          doc.setTextColor(0, 0, 0);
        }
      } else {
        // Mostrar texto "3x4" dentro do quadrado quando não há foto
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("FOTO", fotoX + fotoWidth / 2, fotoY + fotoHeight / 2 - 2, { align: "center" });
        doc.text("3x4", fotoX + fotoWidth / 2, fotoY + fotoHeight / 2 + 4, { align: "center" });
        doc.setTextColor(0, 0, 0);
      }
    } else {
      // Mostrar texto "3x4" dentro do quadrado quando não pode ver foto
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text("FOTO", fotoX + fotoWidth / 2, fotoY + fotoHeight / 2 - 2, { align: "center" });
      doc.text("3x4", fotoX + fotoWidth / 2, fotoY + fotoHeight / 2 + 4, { align: "center" });
      doc.setTextColor(0, 0, 0);
    }

    // SEÇÃO 1: DADOS PESSOAIS
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS PESSOAIS", margin, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    const dadosPessoais = [
      ["Nome Completo", selectedUser.nome || ""],
      ["CPF", selectedUser.cpf || ""],
      ["Data de Nascimento", selectedUser.dataNascimento || ""],
      ["Email", selectedUser.email || ""],
      ["Telefone (WhatsApp)", selectedUser.telefone || ""],
      ["Escolaridade", selectedUser.escolaridade || ""],
    ];

    autoTable(doc, {
      startY: yPos,
      body: dadosPessoais,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50 },
        1: { cellWidth: 110 },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // SEÇÃO 2: ENDEREÇO
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ENDEREÇO", margin, yPos);
    yPos += 7;

    const dadosEndereco = [
      ["CEP", selectedUser.cep || ""],
      ["Rua", selectedUser.rua || ""],
      ["Bairro", selectedUser.bairro || ""],
      ["Cidade", selectedUser.cidade || ""],
      ["Estado", selectedUser.estado || ""],
    ];

    autoTable(doc, {
      startY: yPos,
      body: dadosEndereco,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50 },
        1: { cellWidth: 110 },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // SEÇÃO 3: INFORMAÇÕES ACADÊMICAS
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMAÇÕES ACADÊMICAS", margin, yPos);
    yPos += 7;

    const dataMatricula = selectedUser.dataSolicitacao 
      ? new Date(selectedUser.dataSolicitacao).toLocaleDateString('pt-BR')
      : "";

    const diasEstudo = selectedUser.disponibilidade && selectedUser.disponibilidade.length > 0
      ? selectedUser.disponibilidade.join(", ")
      : "";

    const dadosAcademicos = [
      ["Número de Matrícula", selectedUser.matricula || ""],
      ["Data de Início da Matrícula", dataMatricula],
      ["Turma", selectedUser.turma || ""],
      ["Dias de Estudo", diasEstudo],
    ];

    autoTable(doc, {
      startY: yPos,
      body: dadosAcademicos,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50 },
        1: { cellWidth: 110 },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // SEÇÃO 4: HISTÓRICO DE PRESENÇA
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("HISTÓRICO DE PRESENÇA", margin, yPos);
    yPos += 7;

    const totalLogins = userHistory.filter(h => h.action === "login").length;
    const historicoPresenca = userHistory.length > 0
      ? userHistory.slice(0, 30).map(h => [
          h.action === "login" ? "Presente" : "Saída",
          formatBrasiliaTime(h.timestamp),
        ])
      : [["", ""]];

    autoTable(doc, {
      startY: yPos,
      head: [["Status", "Data/Hora"]],
      body: historicoPresenca,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 98, 255], fontSize: 9 },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Total de Presenças: ${totalLogins}`, margin, yPos);

    // SEÇÃO 5: BOLETIM ESCOLAR OFICIAL (apenas se houver boletim liberado pela diretoria)
    if (userBoletinsLiberados.length > 0) {
      for (const boletim of userBoletinsLiberados) {
        doc.addPage();
        yPos = 20;
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("BOLETIM ESCOLAR", pageWidth / 2, yPos, { align: "center" });
        yPos += 6;
        
        doc.setFontSize(10);
        doc.text(boletim.escola || "Preparatório Vestibulando", pageWidth / 2, yPos, { align: "center" });
        yPos += 10;
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Aluno: ${boletim.alunoNome}`, margin, yPos);
        doc.text(`Matrícula: ${boletim.alunoMatricula || "-"}`, pageWidth - margin - 50, yPos);
        yPos += 5;
        
        doc.text(`Turma: ${boletim.turmaNome}`, margin, yPos);
        doc.text(`Ano Letivo: ${boletim.anoLetivo}`, pageWidth - margin - 50, yPos);
        yPos += 8;
        
        const periodos = boletim.periodos || (boletim.periodoTipo === "bimestre" 
          ? ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"] 
          : ["1º Trimestre", "2º Trimestre", "3º Trimestre"]);
        
        const tableHead = [["Matéria", ...periodos, "Média Final"]];
        const tableBody = boletim.materias.map(m => [
          m.materia,
          ...periodos.map(p => formatNota(m.notas[p])),
          formatNota(m.mediaFinal),
        ]);
        
        autoTable(doc, {
          startY: yPos,
          head: tableHead,
          body: tableBody,
          margin: { left: margin, right: margin },
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 8;
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Média Geral: ${formatNota(boletim.mediaGeral)}`, margin, yPos);
        
        const situacaoTexto = boletim.situacao === "aprovado" ? "APROVADO" : 
                             boletim.situacao === "reprovado" ? "REPROVADO" : "CURSANDO";
        doc.text(`Situação: ${situacaoTexto}`, pageWidth / 2, yPos);
        yPos += 7;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Presenças: ${boletim.presencas || 0}`, margin, yPos);
        doc.text(`Faltas: ${boletim.faltas || 0}`, margin + 40, yPos);
        const frequencia = boletim.percentualPresenca !== null && boletim.percentualPresenca !== undefined 
          ? boletim.percentualPresenca.toFixed(1).replace(".", ",") + "%" 
          : "-";
        doc.text(`Frequência: ${frequencia}`, margin + 80, yPos);
        yPos += 7;
        
        if (boletim.observacoes) {
          yPos += 3;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text("Observações:", margin, yPos);
          yPos += 5;
          doc.setFont("helvetica", "normal");
          const obsLines = doc.splitTextToSize(boletim.observacoes, pageWidth - 2 * margin);
          doc.text(obsLines, margin, yPos);
        }
        
        if (boletim.liberadoEm) {
          yPos = Math.min((doc as any).lastAutoTable.finalY + 50, pageHeight - 30);
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(`Boletim liberado em: ${formatBrasiliaTime(boletim.liberadoEm).split(" ")[0]}`, margin, yPos);
          if (boletim.liberadoPorNome) {
            doc.text(`Por: ${boletim.liberadoPorNome}`, pageWidth / 2, yPos);
          }
          doc.setTextColor(0, 0, 0);
        }
      }
    } else {
      doc.addPage();
      yPos = 20;
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("BOLETIM - NOTAS E AVALIAÇÕES", margin, yPos);
      yPos += 7;

      const boletimData = userEntregas.length > 0
        ? userEntregas.map(e => [
            e.tarefaTitulo,
            formatBrasiliaTime(e.dataEnvio).split(" ")[0],
            e.nota !== undefined ? e.nota.toFixed(1) : "",
            e.status,
          ])
        : [["", "", "", ""]];

      autoTable(doc, {
        startY: yPos,
        head: [["Tarefa/Avaliação", "Data", "Nota", "Status"]],
        body: boletimData,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 98, 255], fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 30 },
          2: { cellWidth: 20 },
          3: { cellWidth: 30 },
        },
        margin: { left: margin, right: margin },
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;

      const notasValidas = userEntregas.filter(e => e.nota !== undefined).map(e => e.nota as number);
      const media = notasValidas.length > 0
        ? (notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length).toFixed(2)
        : "";

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`Média Geral: ${media}`, margin, yPos);
    }

    // SEÇÃO 6: ADVERTÊNCIAS E SUSPENSÕES
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ADVERTÊNCIAS E SUSPENSÕES", margin, yPos);
    yPos += 7;

    const disciplinaryData = userDisciplinary.length > 0
      ? userDisciplinary.map(d => [
          d.tipo === "advertencia" ? "Advertência" : "Suspensão",
          formatBrasiliaTime(d.dataAplicacao).split(" ")[0],
          d.comentario || "",
          d.aplicadoPorNome || "",
          d.ativo ? "Ativa" : "Removida",
        ])
      : [["", "", "", "", ""]];

    autoTable(doc, {
      startY: yPos,
      head: [["Tipo", "Data", "Motivo", "Aplicado Por", "Status"]],
      body: disciplinaryData,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [220, 53, 69], fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 25 },
        2: { cellWidth: 70 },
        3: { cellWidth: 35 },
        4: { cellWidth: 22 },
      },
      margin: { left: margin, right: margin },
    });

    // ASSINATURA DO DIRETOR (no final da última página)
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Adicionar assinatura/carimbo
    try {
      const assinaturaImg = new Image();
      assinaturaImg.src = assinaturaUrl;
      await new Promise((resolve) => {
        assinaturaImg.onload = resolve;
        assinaturaImg.onerror = resolve;
      });
      doc.addImage(assinaturaImg, "PNG", pageWidth / 2 - 45, yPos, 90, 30);
    } catch (error) {
      console.error("Erro ao carregar assinatura:", error);
    }

    // Salvar PDF
    const fileName = `Documentacao_Aluno_${selectedUser.nome.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
  };

  // Gerar Declaração de Matrícula
  const generateDeclaracaoMatricula = async () => {
    if (!selectedUser) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = 30;

    // Função para adicionar texto centralizado
    const addCenteredText = (text: string, y: number, fontSize: number, bold: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(text, pageWidth / 2, y, { align: "center" });
    };

    // Função para adicionar texto justificado
    const addJustifiedText = (text: string, y: number, fontSize: number = 11) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
      doc.text(lines, margin, y, { align: "justify", maxWidth: pageWidth - 2 * margin });
      return y + (lines.length * fontSize * 0.5);
    };

    // Título
    addCenteredText("PREPARATÓRIO VESTIBULANDO", yPos, 14, true);
    yPos += 10;
    addCenteredText("DECLARAÇÃO DE MATRÍCULA", yPos, 12, true);
    yPos += 15;

    // Parágrafo 1
    const nome = selectedUser.nome.toUpperCase();
    const cpf = selectedUser.cpf || "N/A";
    const texto1 = `          Declaramos para os devidos fins, que o(a) aluno(a): ${nome}, portador(a) do CPF de Número: ${cpf}, encontra-se devidamente matriculado(a) no CURSO ONLINE PREPARATÓRIO, na área de formação continuada em EDUCAÇÃO. O curso é oferecido por VESTIBULANDO EAD, por meio da plataforma online.`;
    yPos = addJustifiedText(texto1, yPos);
    yPos += 10;

    // Parágrafo 2
    const texto2 = `          Esta declaração não substitui o certificado de conclusão de curso, caso o aluno não apresente o respectivo em 60(sessenta) dias, a mesma será considerada inválida.`;
    yPos = addJustifiedText(texto2, yPos);
    yPos += 10;

    // Parágrafo 3
    const texto3 = `          Somos uma Instituição de Ensino a Distância, devidamente constituída, fazemos parte do grupo Vestibulando Cursos On-line. Nossos cursos são todos online e são considerados cursos livres (nível básico). Não somos uma IES (Instituição de Ensino Superior). Não oferecemos cursos de graduação, extensão ou pós-graduação.`;
    yPos = addJustifiedText(texto3, yPos);
    yPos += 10;

    // Parágrafo 4
    const texto4 = `          Nosso certificado é um documento verídico, com amparo legal em todo o território nacional, pois está em conformidade com a Lei nº 9.394/96, com o Decreto Presidencial nº 5.154/04 e o 1º a ser emitido, de acordo com os critérios do Ministério Público de Goiás.`;
    yPos = addJustifiedText(texto4, yPos);
    yPos += 10;

    // Parágrafo 5
    const texto5 = `          O título do curso não implica em formação profissional. Sua certificação não permite o exercício da profissão regulamentada em lei, sem que sejam atendidos todos os requisitos legalmente exigidos pela categoria.`;
    yPos = addJustifiedText(texto5, yPos);
    yPos += 10;

    // Número de matrícula
    const matricula = selectedUser.matricula || "N/A";
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`          Número de matrícula atual do aluno: ${matricula}`, margin, yPos);
    yPos += 20;

    // Data
    const hoje = new Date();
    const dia = hoje.getDate().toString().padStart(2, '0');
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const mes = meses[hoje.getMonth()];
    const ano = hoje.getFullYear();
    const dataExtenso = `${dia} de ${mes} de ${ano}.`;
    
    addCenteredText(dataExtenso, yPos, 11);
    yPos += 30;

    // Assinatura
    try {
      const assinaturaImg = new Image();
      assinaturaImg.src = assinaturaDeclaracaoUrl;
      await new Promise((resolve) => {
        assinaturaImg.onload = resolve;
        assinaturaImg.onerror = resolve;
      });
      // Centralizar a assinatura - BEM GRANDE
      const imgWidth = 140;
      const imgHeight = 43;
      doc.addImage(assinaturaImg, "PNG", (pageWidth - imgWidth) / 2, yPos, imgWidth, imgHeight);
    } catch (error) {
      console.error("Erro ao carregar assinatura:", error);
      // Adicionar linha e texto caso a assinatura não carregue
      yPos += 5;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("_".repeat(50), pageWidth / 2, yPos, { align: "center" });
      yPos += 5;
      doc.text("Diretor Responsável", pageWidth / 2, yPos, { align: "center" });
    }

    // Salvar PDF
    const fileName = `Declaracao_Matricula_${selectedUser.nome.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com pesquisa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentação de Usuários
          </CardTitle>
          <CardDescription>
            Visualize e exporte documentação completa de alunos e professores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, email ou matrícula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-documentation"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de usuários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usuários ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Foto</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.uid} data-testid={`row-doc-user-${user.uid}`}>
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          {canViewPhoto(user) && (
                            <AvatarImage src={user.fotoUrl || user.fotoBase64} alt={user.nome} />
                          )}
                          <AvatarFallback>
                            {user.nome.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={user.tipo === "aluno" ? "default" : "secondary"}
                          className="no-default-hover-elevate no-default-active-elevate"
                        >
                          {user.tipo === "aluno" ? "Aluno" : "Professor"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {user.matricula || "-"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(user);
                            setDetailsDialogOpen(true);
                          }}
                          data-testid={`button-view-doc-${user.uid}`}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Ver Documentação
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de detalhes */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-user-documentation">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {canViewPhoto(selectedUser) && (
                      <AvatarImage src={selectedUser.fotoUrl || selectedUser.fotoBase64} alt={selectedUser.nome} />
                    )}
                    <AvatarFallback>
                      {selectedUser.nome.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {selectedUser.nome}
                </DialogTitle>
                <DialogDescription>
                  Documentação completa e histórico de atividades
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {userBoletinsLiberados.length > 0 && (
                    <Badge variant="default" className="no-default-hover-elevate no-default-active-elevate">
                      <GraduationCap className="h-3 w-3 mr-1" />
                      {userBoletinsLiberados.length} boletim(ns) liberado(s) - incluso(s) no PDF
                    </Badge>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={generatePDF} data-testid="button-download-pdf">
                      <Download className="h-4 w-4 mr-2" />
                      Documentação Completa
                    </Button>
                    <Button onClick={generateDeclaracaoMatricula} variant="outline" data-testid="button-download-declaracao">
                      <FileText className="h-4 w-4 mr-2" />
                      Declaração de Matrícula
                    </Button>
                  </div>
                </div>

                <Tabs defaultValue="personal" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="personal">Dados Pessoais</TabsTrigger>
                    <TabsTrigger value="address">Endereço</TabsTrigger>
                    <TabsTrigger value="history">Histórico</TabsTrigger>
                    {selectedUser.tipo === "aluno" && (
                      <TabsTrigger value="tasks">Tarefas</TabsTrigger>
                    )}
                    {selectedUser.tipo === "aluno" && (
                      <TabsTrigger value="boletins">Boletins</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="personal" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <UserIcon className="h-5 w-5" />
                          Informações Pessoais
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Nome Completo</p>
                          <p className="font-medium">{selectedUser.nome}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Email</p>
                          <p className="font-medium">{selectedUser.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">CPF</p>
                          <p className="font-medium">{selectedUser.cpf || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                          <p className="font-medium">{selectedUser.dataNascimento || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Telefone</p>
                          <p className="font-medium">{selectedUser.telefone || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Escolaridade</p>
                          <p className="font-medium">{selectedUser.escolaridade || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Matrícula</p>
                          <p className="font-medium">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {selectedUser.matricula || "N/A"}
                            </code>
                          </p>
                        </div>
                        {selectedUser.tipo === "aluno" && (
                          <div>
                            <p className="text-sm text-muted-foreground">Turma</p>
                            <p className="font-medium">{selectedUser.turma || "Sem turma"}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="address" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Endereço Residencial
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">CEP</p>
                          <p className="font-medium">{selectedUser.cep || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Rua</p>
                          <p className="font-medium">{selectedUser.rua || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Bairro</p>
                          <p className="font-medium">{selectedUser.bairro || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Cidade</p>
                          <p className="font-medium">{selectedUser.cidade || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Estado</p>
                          <p className="font-medium">{selectedUser.estado || "N/A"}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="history" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Histórico de Login/Logout
                        </CardTitle>
                        <CardDescription>
                          Horários em fuso de Brasília (GMT-3)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {userHistory.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Nenhum registro de acesso encontrado
                          </p>
                        ) : (
                          <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Ação</TableHead>
                                  <TableHead>Data/Hora</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {userHistory.map((history, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>
                                      <Badge variant={history.action === "login" ? "default" : "secondary"}>
                                        {history.action === "login" ? "Entrada" : "Saída"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{formatBrasiliaTime(history.timestamp)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {selectedUser.tipo === "aluno" && (
                    <TabsContent value="tasks" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <BookOpen className="h-5 w-5" />
                            Tarefas Entregues
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {userEntregas.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                              Nenhuma tarefa entregue
                            </p>
                          ) : (
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Tarefa</TableHead>
                                    <TableHead>Data de Entrega</TableHead>
                                    <TableHead>Nota</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {userEntregas.map((entrega) => (
                                    <TableRow key={entrega.id}>
                                      <TableCell className="font-medium">{entrega.tarefaTitulo}</TableCell>
                                      <TableCell>{formatBrasiliaTime(entrega.dataEnvio)}</TableCell>
                                      <TableCell>
                                        {entrega.nota !== undefined ? (
                                          <Badge variant="default" className="no-default-hover-elevate no-default-active-elevate">
                                            {entrega.nota}/10
                                          </Badge>
                                        ) : (
                                          <span className="text-sm text-muted-foreground">Pendente</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                                          {entrega.status}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  )}

                  {selectedUser.tipo === "aluno" && (
                    <TabsContent value="boletins" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <GraduationCap className="h-5 w-5" />
                            Boletins Escolares Liberados
                          </CardTitle>
                          <CardDescription>
                            Boletins liberados pela diretoria são incluídos automaticamente no PDF de documentação
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {userBoletinsLiberados.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                              Nenhum boletim liberado pela diretoria
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {userBoletinsLiberados.map((boletim) => (
                                <div 
                                  key={boletim.id} 
                                  className="p-4 border rounded-lg space-y-3"
                                  data-testid={`boletim-liberado-${boletim.id}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                      <div className="p-2 bg-green-500/10 rounded-lg">
                                        <GraduationCap className="h-5 w-5 text-green-600" />
                                      </div>
                                      <div>
                                        <p className="font-medium">
                                          Boletim {boletim.anoLetivo} - {boletim.turmaNome}
                                        </p>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <span>Média: {formatNota(boletim.mediaGeral)}</span>
                                          <span>|</span>
                                          <Badge 
                                            variant={
                                              boletim.situacao === "aprovado" ? "default" :
                                              boletim.situacao === "reprovado" ? "destructive" : "secondary"
                                            }
                                            className="no-default-hover-elevate no-default-active-elevate"
                                          >
                                            {boletim.situacao.charAt(0).toUpperCase() + boletim.situacao.slice(1)}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                    <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-green-600 border-green-600">
                                      Incluso no PDF
                                    </Badge>
                                  </div>
                                  
                                  <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="text-xs">Matéria</TableHead>
                                          {(boletim.periodos || (boletim.periodoTipo === "bimestre" 
                                            ? ["1º Bim", "2º Bim", "3º Bim", "4º Bim"] 
                                            : ["1º Tri", "2º Tri", "3º Tri"])).map((p, i) => (
                                            <TableHead key={i} className="text-xs text-center">{p.replace("Bimestre", "Bim").replace("Trimestre", "Tri")}</TableHead>
                                          ))}
                                          <TableHead className="text-xs text-center">Média</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {boletim.materias.slice(0, 5).map((m, idx) => {
                                          const periodos = boletim.periodos || (boletim.periodoTipo === "bimestre" 
                                            ? ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"] 
                                            : ["1º Trimestre", "2º Trimestre", "3º Trimestre"]);
                                          return (
                                            <TableRow key={idx}>
                                              <TableCell className="text-xs">{m.materia}</TableCell>
                                              {periodos.map((p, i) => (
                                                <TableCell key={i} className="text-xs text-center">{formatNota(m.notas[p])}</TableCell>
                                              ))}
                                              <TableCell className="text-xs text-center font-medium">{formatNota(m.mediaFinal)}</TableCell>
                                            </TableRow>
                                          );
                                        })}
                                        {boletim.materias.length > 5 && (
                                          <TableRow>
                                            <TableCell colSpan={6} className="text-xs text-center text-muted-foreground">
                                              ... e mais {boletim.materias.length - 5} matérias
                                            </TableCell>
                                          </TableRow>
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>Presenças: {boletim.presencas || 0}</span>
                                    <span>Faltas: {boletim.faltas || 0}</span>
                                    {boletim.liberadoEm && (
                                      <span>Liberado em: {formatBrasiliaTime(boletim.liberadoEm).split(" ")[0]}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
