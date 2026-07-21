import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

const expectedCapabilityCounts = [9, 21, 17, 12, 19, 14, 13, 12, 17, 15, 17, 19, 13, 13, 16, 19, 16, 17, 13, 15, 17, 12, 23, 16, 20, 15, 24, 18, 19, 12];
const bundle = await build({
  entryPoints: [resolve(root, "client/src/features/school/schoolCatalog.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const catalog = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const modules = catalog.SCHOOL_MODULES;
const engineBundle = await build({
  entryPoints: [resolve(root, "client/src/features/school/schoolCapabilityEngine.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const capabilityEngine = await import(`data:text/javascript;base64,${Buffer.from(engineBundle.outputFiles[0].text).toString("base64")}`);

check(Array.isArray(modules) && modules.length === 30, `Esperados 30 módulos; encontrados ${modules?.length ?? 0}.`);
check(new Set(modules.map((module) => module.id)).size === 30, "Há identificadores de módulos duplicados.");
check(modules.every((module, index) => module.number === index + 1), "A numeração dos módulos não é contínua de 1 a 30.");

for (const module of modules) {
  const expected = expectedCapabilityCounts[module.number - 1];
  check(module.capabilities.length >= expected, `Módulo ${module.number} possui ${module.capabilities.length}/${expected} requisitos catalogados.`);
  check(module.workflows.length > 0, `Módulo ${module.number} não possui processos operacionais.`);
  check(module.statuses.length > 0, `Módulo ${module.number} não possui estados de fluxo.`);
  check(module.fields.length > 0, `Módulo ${module.number} não possui campos específicos.`);
}

const frequencyModule = modules.find((module) => module.id === "frequencia");
const frequencyResult = capabilityEngine.applyCapabilityAutomations(frequencyModule, "Alertas de excesso de faltas", { totalAulas: 100, presencas: 70, frequenciaMinima: 75 }, "confirmada", "2026-07-21T12:00:00.000Z");
check(frequencyResult.customData.percentual === 70, "O cálculo automático de frequência não produziu 70%.");
check(frequencyResult.automation.health === "attention", "O alerta de frequência abaixo do mínimo não foi acionado.");

const gradesModule = modules.find((module) => module.id === "notas-boletim");
const gradeResult = capabilityEngine.applyCapabilityAutomations(gradesModule, "Média simples ou ponderada", { nota1: 8, peso1: 2, nota2: 6, peso2: 1, mediaMinima: 6 }, "em andamento", "2026-07-21T12:00:00.000Z");
check(gradeResult.customData.mediaCalculada === 7.3, "O cálculo automático de média ponderada está incorreto.");

const financeModule = modules.find((module) => module.id === "financeiro");
const financeResult = capabilityEngine.applyCapabilityAutomations(financeModule, "Multa, juros e desconto por antecipação", { valorOriginal: 100, descontoPercentual: 10, multaPercentual: 2, jurosPercentual: 3, valorPago: 20 }, "aberto", "2026-07-21T12:00:00.000Z");
check(financeResult.customData.valorCalculado === 95 && financeResult.customData.saldoAberto === 75, "O cálculo financeiro automático está incorreto.");

const capacityErrors = capabilityEngine.validateCapabilityData(modules.find((module) => module.id === "estrutura-academica"), "Vagas e capacidade máxima", { capacidadeTotal: 30, ocupacaoAtual: 29, quantidadeReservada: 2 }, "vigente");
check(capacityErrors.some((message) => message.includes("excedida")), "O bloqueio de capacidade excedida não foi acionado.");

const requirementIds = new Set();
for (const module of modules) {
  for (const capability of module.capabilities) {
    const blueprint = capabilityEngine.capabilityBlueprint(module, capability);
    check(/^VE-RQ-\d{2}-\d{2}$/.test(blueprint.id), `Requisito sem identificador operacional válido: ${module.number} · ${capability}.`);
    check(!requirementIds.has(blueprint.id), `Identificador operacional duplicado: ${blueprint.id}.`);
    requirementIds.add(blueprint.id);
    check(blueprint.fields.length >= 4, `${blueprint.id} não possui formulário contextual acionável.`);
    check(blueprint.automations.length >= 2, `${blueprint.id} não possui automação específica além da auditoria transversal.`);
    check(module.workflows.includes(blueprint.workflow), `${blueprint.id} aponta para processo inexistente.`);
  }
}

const validModuleIds = new Set(modules.map((module) => module.id));
for (const [role, ids] of Object.entries(catalog.ROLE_DEFAULT_MODULES)) {
  check(ids.every((id) => id === "*" || validModuleIds.has(id)), `O perfil ${role} referencia módulo inexistente.`);
}
for (const [role, ids] of Object.entries(catalog.ROLE_WRITE_MODULES)) {
  check(ids.every((id) => id === "*" || validModuleIds.has(id)), `O perfil de escrita ${role} referencia módulo inexistente.`);
}

const protectedChatHashes = {
  "client/src/pages/ChatPage.tsx": "6f3c287a96137cd4805960e6fa6f9a09b7dc7228f1be1dff30348505b22f0e2d",
  "client/src/pages/ChatConversationPage.tsx": "6ff0dc76d9964e5f037841b7b512cf87ecc7955c89871dab9270d283e2690b66",
  "client/src/components/ChatWindow.tsx": "366866188eb9d08374a8c1afd17a2a920e2f625e01602ba774d2b6ce3bf8437c",
  "client/src/components/ConversationItem.tsx": "cdee1860db894cbb16c8b27a53c056c28befd0991bc2fdff59a83b7cbbf50298",
};
for (const [relativePath, expectedHash] of Object.entries(protectedChatHashes)) {
  const path = resolve(root, relativePath);
  check(existsSync(path), `Arquivo protegido do chat ausente: ${relativePath}.`);
  if (existsSync(path)) {
    const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
    check(hash === expectedHash, `Arquivo protegido do chat foi alterado: ${relativePath}.`);
  }
}

const requiredArtifacts = [
  "firestore.rules", "firestore.indexes.json", ".env.example",
  "client/public/manifest.webmanifest", "client/public/openapi.json", "client/public/privacy.html",
  "client/public/terms.html", "client/public/cookies.html", "client/public/school-icon-192.png",
  "client/public/school-icon-512.png", "client/src/features/school/SchoolManagementSuite.tsx",
  "client/src/features/school/GuardianFamilyPanel.tsx", "client/src/features/school/AccessControlPanel.tsx",
  "client/src/features/school/schoolCapabilityEngine.ts", "docs/MATRIZ-OPERACIONAL-483-REQUISITOS.md",
  "ATUALIZAR_GITHUB_E_CLOUDFLARE.bat", "docs/ATUALIZACAO-CLOUDFLARE.md",
  "scripts/confirm-cloudflare-version.ps1",
  "client/src/lib/firestoreFileStore.ts", "client/src/pages/FirestoreFilePage.tsx",
];
for (const artifact of requiredArtifacts) check(existsSync(resolve(root, artifact)), `Artefato obrigatório ausente: ${artifact}.`);

const firestoreRules = readFileSync(resolve(root, "firestore.rules"), "utf8");
const windowsPublisher = readFileSync(resolve(root, "ATUALIZAR_GITHUB_E_CLOUDFLARE.bat"), "utf8");
const cloudflareVersionChecker = readFileSync(resolve(root, "scripts/confirm-cloudflare-version.ps1"), "utf8");
const firebaseConfiguration = readFileSync(resolve(root, "firebase.json"), "utf8");
const noStorageSources = [
  "client/src/lib/firebase.ts", "client/src/features/school/schoolData.ts", "client/src/pages/StudentDashboard.tsx",
  "client/src/pages/TeacherDashboard.tsx", "client/src/components/AlunoAvaliacoesTab.tsx",
  "client/src/components/AvaliacoesTab.tsx", "client/src/components/EditProfileDialog.tsx", "server/routes.ts",
].map((path) => readFileSync(resolve(root, path), "utf8")).join("\n");
check(!firestoreRules.includes("allow list: if true"), "A coleção de usuários voltou a permitir listagem pública.");
check(!firestoreRules.includes("allow delete: if isAdmin() || true"), "Foi detectada exclusão pública legada.");
check(firestoreRules.includes("match /schoolFiles/{fileId}") && firestoreRules.includes("match /chunks/{chunkId}"), "As regras do repositório gratuito de arquivos estão ausentes.");
check(!noStorageSources.includes("firebase/storage") && !noStorageSources.includes("firebaseAdmin.storage()"), "O código voltou a depender do Firebase Storage.");
check(!firebaseConfiguration.includes('"storage"'), "firebase.json voltou a exigir Firebase Storage.");
check(windowsPublisher.includes('findstr /I /C:"%SITE_HOST%"'), "O publicador não valida a conta proprietária do domínio principal.");
check(windowsPublisher.includes("yasminpereiragabrielly88@gmail.com") && windowsPublisher.includes("vestibulando-yasmin"), "O publicador não fixa a conta e o perfil exclusivos do projeto original.");
check(windowsPublisher.includes("wrangler pages project list --json") && windowsPublisher.includes("wrangler pages deployment list"), "O publicador não confirma o projeto existente antes do envio.");
check(!windowsPublisher.includes("wrangler pages project create") && windowsPublisher.includes('set "CI=true"'), "O publicador pode tentar criar um projeto Cloudflare novo.");
check(windowsPublisher.indexOf("call :VALIDAR_PROJETO_CLOUDFLARE") < windowsPublisher.indexOf("wrangler pages deploy"), "A validação do projeto Cloudflare precisa ocorrer antes do deploy.");
check(windowsPublisher.includes("confirm-cloudflare-version.ps1") && cloudflareVersionChecker.includes("Attempts = 18") && cloudflareVersionChecker.includes("Start-Sleep -Seconds"), "O publicador não aguarda a propagação da versão no domínio principal.");
check(cloudflareVersionChecker.includes('"Cache-Control" = "no-cache"') && cloudflareVersionChecker.includes("deploy-version.json"), "A confirmação do domínio não evita respostas em cache.");
check(windowsPublisher.includes("SITE_WARNING") && windowsPublisher.includes("o dominio principal ainda esta propagando"), "O publicador trata atraso de propagação como falha definitiva.");
check(windowsPublisher.includes("--only firestore:rules,firestore:indexes") && !windowsPublisher.includes("--only storage"), "O publicador não deve tentar ativar ou publicar Firebase Storage.");
check(windowsPublisher.includes("git config core.longpaths true") && windowsPublisher.includes("Falha no git add"), "O publicador não protege o envio ao GitHub contra caminhos longos.");
const pagesDeployLine = windowsPublisher.split(/\r?\n/).find((line) => line.includes("wrangler pages deploy")) || "";
check(!pagesDeployLine.includes("--branch="), "O deploy direto do Pages não deve forçar uma branch de preview.");
check(pagesDeployLine.includes('--profile="%CF_PROFILE%"') && pagesDeployLine.includes("<nul"), "O deploy do Pages não está protegido contra prompts de criação.");

const openApi = JSON.parse(readFileSync(resolve(root, "client/public/openapi.json"), "utf8"));
check(openApi.openapi === "3.0.3", "Documento OpenAPI inválido ou em versão inesperada.");
check(Object.keys(openApi.paths || {}).length >= 18, "A API documentada não contém todos os fluxos operacionais esperados.");
JSON.parse(readFileSync(resolve(root, "firestore.indexes.json"), "utf8"));
JSON.parse(readFileSync(resolve(root, "client/public/manifest.webmanifest"), "utf8"));

const totalCapabilities = modules.reduce((total, module) => total + module.capabilities.length, 0);
check(requirementIds.size === totalCapabilities, `Motor operacional cobre ${requirementIds.size}/${totalCapabilities} requisitos.`);
if (errors.length) {
  console.error(`Verificação escolar falhou com ${errors.length} problema(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Verificação aprovada: 30 módulos, ${totalCapabilities} requisitos acionáveis com IDs únicos, ${Object.keys(openApi.paths).length} rotas documentadas e chat protegido íntegro.`);
