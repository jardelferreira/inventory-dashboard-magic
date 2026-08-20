import * as XLSX from "xlsx";
import { getDB, uid } from "@/db/db";
import type {
  Categoria,
  Empresa,
  Funcionario,
  Local,
  Movimentacao,
  Produto,
  Projeto,
  Unidade,
} from "@/types";
import { normalizar } from "@/utils/format";

export interface DatasetImportado {
  projetos: Projeto[];
  categorias: Categoria[];
  unidades: Unidade[];
  empresas: Empresa[];
  funcionarios: Funcionario[];
  locais: Local[];
  produtos: Produto[];
  movimentacoes: Movimentacao[];
  problemas: string[];
}

const S = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const B = (v: unknown) => {
  const s = S(v).toUpperCase();
  if (["", "1", "SIM", "TRUE", "VERDADEIRO", "ATIVO", "S"].includes(s)) return true;
  return false;
};
const N = (v: unknown) => {
  if (typeof v === "number") return v;
  const s = S(v).replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const D = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d)
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = S(v);
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
};

function rows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  return raw.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[S(k).toUpperCase()] = v;
    return out;
  });
}

export function lerArquivo(buffer: ArrayBuffer): DatasetImportado {
  const wb = XLSX.read(buffer, { cellDates: true });
  const problemas: string[] = [];

  const projetos: Projeto[] = rows(wb, "PROJETOS").map((r) => ({
    id: S(r["ID"]) || uid(),
    codigo: S(r["CODIGO"]),
    nome: S(r["NOME"]) || S(r["CODIGO"]) || "Projeto importado",
    empresa_id: S(r["EMPRESA_ID"]) || null,
    status: (S(r["STATUS"]).toUpperCase() || "ATIVO") as Projeto["status"],
    data_inicio: D(r["DATA_INICIO"]) || null,
    data_fim: D(r["DATA_FIM"]) || null,
    observacao: S(r["OBSERVACAO"]) || null,
  }));

  const categorias: Categoria[] = rows(wb, "CATEGORIAS").map((r) => ({
    id: S(r["ID"]) || uid(),
    nome: S(r["NOME"]),
    ativo: B(r["ATIVO"]),
  }));

  const unidades: Unidade[] = rows(wb, "UNIDADES").map((r) => ({
    id: S(r["ID"]) || uid(),
    sigla: S(r["SIGLA"]),
    descricao: S(r["DESCRICAO"]),
    ativo: B(r["ATIVO"]),
  }));

  const empresas: Empresa[] = rows(wb, "EMPRESAS").map((r) => ({
    id: S(r["ID"]) || uid(),
    nome: S(r["NOME"]),
    tipo: (S(r["TIPO"]).toUpperCase().startsWith("PR")
      ? "PROPRIA"
      : "TERCEIRA") as Empresa["tipo"],
    ativo: B(r["ATIVO"]),
  }));

  const funcionarios: Funcionario[] = rows(wb, "FUNCIONARIOS").map((r) => ({
    id: S(r["ID"]) || uid(),
    matricula: S(r["MATRICULA"]) || null,
    nome: S(r["NOME"]),
    funcao: S(r["FUNCAO"]) || null,
    encarregado_id: S(r["ENCARREGADO_ID"]) || null,
    empresa_id: S(r["EMPRESA_ID"]) || null,
    status: (S(r["STATUS"]).toUpperCase() === "INATIVO"
      ? "INATIVO"
      : "ATIVO") as Funcionario["status"],
  }));

  const locais: Local[] = rows(wb, "LOCAIS").map((r) => ({
    id: S(r["ID"]) || uid(),
    codigo: S(r["CODIGO"]) || null,
    nome: S(r["NOME"]),
    local_pai_id: S(r["LOCAL_PAI_ID"]) || null,
    ativo: B(r["ATIVO"]),
  }));

  const produtos: Produto[] = rows(wb, "PRODUTOS").map((r) => ({
    id: S(r["ID"]) || uid(),
    codigo: S(r["CODIGO"]) || null,
    nome: S(r["NOME"]),
    descricao: S(r["DESCRICAO"]) || null,
    categoria_id: S(r["CATEGORIA_ID"]) || null,
    unidade_id: S(r["UNIDADE_ID"]) || null,
    marca: S(r["MARCA"]) || null,
    modelo: S(r["MODELO"]) || null,
    estoque_minimo: N(r["ESTOQUE_MINIMO"]),
    ativo: B(r["ATIVO"]),
  }));

  const movimentacoes: Movimentacao[] = rows(wb, "MOVIMENTACOES").map((r) => ({
    id: S(r["ID"]) || uid(),
    projeto_id: S(r["PROJETO_ID"]),
    data: D(r["DATA"]),
    tipo: (S(r["TIPO"]).toUpperCase() || "SAIDA") as Movimentacao["tipo"],
    produto_id: S(r["PRODUTO_ID"]),
    quantidade: Math.abs(N(r["QUANTIDADE"])),
    sinal: N(r["QUANTIDADE"]) < 0 ? -1 : 1,
    funcionario_id: S(r["FUNCIONARIO_ID"]) || null,
    encarregado_id: S(r["ENCARREGADO_ID"]) || null,
    empresa_id: S(r["EMPRESA_ID"]) || null,
    local_id: S(r["LOCAL_ID"]) || null,
    observacao: S(r["OBSERVACAO"]) || null,
  }));

  // ---------- Validações ----------
  const dup = (nome: string, ids: string[]) => {
    const seen = new Set<string>();
    const dups = new Set<string>();
    ids.forEach((i) => (seen.has(i) ? dups.add(i) : seen.add(i)));
    if (dups.size) problemas.push(`${nome}: ${dups.size} ID(s) duplicado(s)`);
  };
  dup("Produtos", produtos.map((p) => p.id));
  dup("Funcionários", funcionarios.map((f) => f.id));
  dup("Empresas", empresas.map((e) => e.id));
  dup("Movimentações", movimentacoes.map((m) => m.id));

  const semelhantes = (nome: string, nomes: string[]) => {
    const map = new Map<string, number>();
    nomes.forEach((n) => map.set(normalizar(n), (map.get(normalizar(n)) ?? 0) + 1));
    const qtd = [...map.values()].filter((v) => v > 1).length;
    if (qtd) problemas.push(`${nome}: ${qtd} possível(is) duplicidade(s) por nome`);
  };
  semelhantes("Empresas", empresas.map((e) => e.nome));
  semelhantes("Produtos", produtos.map((p) => p.nome));

  const unidIds = new Set(unidades.map((u) => u.id));
  const semUnid = produtos.filter((p) => !p.unidade_id || !unidIds.has(p.unidade_id));
  if (semUnid.length)
    problemas.push(`${semUnid.length} produto(s) sem unidade válida`);

  const semEmp = funcionarios.filter((f) => !f.empresa_id);
  if (semEmp.length) problemas.push(`${semEmp.length} funcionário(s) sem empresa`);

  const prodIds = new Set(produtos.map((p) => p.id));
  const movSemProd = movimentacoes.filter((m) => !prodIds.has(m.produto_id));
  if (movSemProd.length)
    problemas.push(`${movSemProd.length} movimentação(ões) com produto inexistente`);

  const movQtd = movimentacoes.filter((m) => !(m.quantidade > 0));
  if (movQtd.length)
    problemas.push(`${movQtd.length} movimentação(ões) com quantidade inválida`);

  const movData = movimentacoes.filter((m) => !m.data);
  if (movData.length) problemas.push(`${movData.length} movimentação(ões) com data inválida`);

  const movSemLocal = movimentacoes.filter((m) => !m.local_id);
  if (movSemLocal.length)
    problemas.push(`${movSemLocal.length} movimentação(ões) sem local`);

  return {
    projetos,
    categorias,
    unidades,
    empresas,
    funcionarios,
    locais,
    produtos,
    movimentacoes,
    problemas,
  };
}

/** Grava o dataset no IndexedDB, mesclando por ID. */
export async function salvarDataset(ds: DatasetImportado, projetoId?: string) {
  const db = getDB();
  await db.transaction(
    "rw",
    [
      db.projetos,
      db.categorias,
      db.unidades,
      db.empresas,
      db.funcionarios,
      db.locais,
      db.produtos,
      db.movimentacoes,
    ],
    async () => {
      if (ds.projetos.length) await db.projetos.bulkPut(ds.projetos);
      await db.categorias.bulkPut(ds.categorias);
      await db.unidades.bulkPut(ds.unidades);
      await db.empresas.bulkPut(ds.empresas);
      await db.funcionarios.bulkPut(ds.funcionarios);
      await db.locais.bulkPut(ds.locais);
      await db.produtos.bulkPut(ds.produtos);
      const alvo = projetoId ?? ds.projetos[0]?.id;
      await db.movimentacoes.bulkPut(
        ds.movimentacoes.map((m) => ({
          ...m,
          projeto_id: m.projeto_id || alvo || "",
        })),
      );
    },
  );
}

export async function exportarProjeto(projetoId: string) {
  const db = getDB();
  const [projeto, categorias, unidades, empresas, funcionarios, locais, produtos] =
    await Promise.all([
      db.projetos.get(projetoId),
      db.categorias.toArray(),
      db.unidades.toArray(),
      db.empresas.toArray(),
      db.funcionarios.toArray(),
      db.locais.toArray(),
      db.produtos.toArray(),
    ]);
  const movimentacoes = await db.movimentacoes
    .where("projeto_id")
    .equals(projetoId)
    .toArray();

  const wb = XLSX.utils.book_new();
  const add = (nome: string, data: Record<string, unknown>[], header: string[]) => {
    const ws = XLSX.utils.json_to_sheet(data, { header });
    XLSX.utils.book_append_sheet(wb, ws, nome);
  };

  add(
    "CONFIGURACAO",
    [
      { CAMPO: "VERSAO", VALOR: "1.0" },
      { CAMPO: "PROJETO", VALOR: projeto?.nome ?? "" },
      { CAMPO: "EXPORTADO_EM", VALOR: new Date().toISOString() },
    ],
    ["CAMPO", "VALOR"],
  );
  add(
    "PROJETOS",
    projeto
      ? [
          {
            ID: projeto.id,
            CODIGO: projeto.codigo,
            NOME: projeto.nome,
            EMPRESA_ID: projeto.empresa_id ?? "",
            STATUS: projeto.status,
            DATA_INICIO: projeto.data_inicio ?? "",
            DATA_FIM: projeto.data_fim ?? "",
            OBSERVACAO: projeto.observacao ?? "",
          },
        ]
      : [],
    ["ID", "CODIGO", "NOME", "EMPRESA_ID", "STATUS", "DATA_INICIO", "DATA_FIM", "OBSERVACAO"],
  );
  add(
    "CATEGORIAS",
    categorias.map((c) => ({ ID: c.id, NOME: c.nome, ATIVO: c.ativo ? 1 : 0 })),
    ["ID", "NOME", "ATIVO"],
  );
  add(
    "UNIDADES",
    unidades.map((u) => ({
      ID: u.id,
      SIGLA: u.sigla,
      DESCRICAO: u.descricao,
      ATIVO: u.ativo ? 1 : 0,
    })),
    ["ID", "SIGLA", "DESCRICAO", "ATIVO"],
  );
  add(
    "EMPRESAS",
    empresas.map((e) => ({ ID: e.id, NOME: e.nome, TIPO: e.tipo, ATIVO: e.ativo ? 1 : 0 })),
    ["ID", "NOME", "TIPO", "ATIVO"],
  );
  add(
    "FUNCIONARIOS",
    funcionarios.map((f) => ({
      ID: f.id,
      MATRICULA: f.matricula ?? "",
      NOME: f.nome,
      FUNCAO: f.funcao ?? "",
      ENCARREGADO_ID: f.encarregado_id ?? "",
      EMPRESA_ID: f.empresa_id ?? "",
      STATUS: f.status,
    })),
    ["ID", "MATRICULA", "NOME", "FUNCAO", "ENCARREGADO_ID", "EMPRESA_ID", "STATUS"],
  );
  add(
    "LOCAIS",
    locais.map((l) => ({
      ID: l.id,
      CODIGO: l.codigo ?? "",
      NOME: l.nome,
      LOCAL_PAI_ID: l.local_pai_id ?? "",
      ATIVO: l.ativo ? 1 : 0,
    })),
    ["ID", "CODIGO", "NOME", "LOCAL_PAI_ID", "ATIVO"],
  );
  add(
    "PRODUTOS",
    produtos.map((p) => ({
      ID: p.id,
      CODIGO: p.codigo ?? "",
      NOME: p.nome,
      DESCRICAO: p.descricao ?? "",
      CATEGORIA_ID: p.categoria_id ?? "",
      UNIDADE_ID: p.unidade_id ?? "",
      MARCA: p.marca ?? "",
      MODELO: p.modelo ?? "",
      ESTOQUE_MINIMO: p.estoque_minimo,
      ATIVO: p.ativo ? 1 : 0,
    })),
    [
      "ID",
      "CODIGO",
      "NOME",
      "DESCRICAO",
      "CATEGORIA_ID",
      "UNIDADE_ID",
      "MARCA",
      "MODELO",
      "ESTOQUE_MINIMO",
      "ATIVO",
    ],
  );
  add(
    "MOVIMENTACOES",
    movimentacoes.map((m) => ({
      ID: m.id,
      PROJETO_ID: m.projeto_id,
      DATA: m.data,
      TIPO: m.tipo,
      PRODUTO_ID: m.produto_id,
      QUANTIDADE: (m.sinal ?? 1) < 0 ? -m.quantidade : m.quantidade,
      FUNCIONARIO_ID: m.funcionario_id ?? "",
      ENCARREGADO_ID: m.encarregado_id ?? "",
      EMPRESA_ID: m.empresa_id ?? "",
      LOCAL_ID: m.local_id ?? "",
      OBSERVACAO: m.observacao ?? "",
    })),
    [
      "ID",
      "PROJETO_ID",
      "DATA",
      "TIPO",
      "PRODUTO_ID",
      "QUANTIDADE",
      "FUNCIONARIO_ID",
      "ENCARREGADO_ID",
      "EMPRESA_ID",
      "LOCAL_ID",
      "OBSERVACAO",
    ],
  );

  const slug = (projeto?.codigo || projeto?.nome || "PROJETO")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  XLSX.writeFile(wb, `MODELO_GESTAO_ALMOXARIFADO_${slug}.xlsx`);
}

export async function gerarBackup() {
  const db = getDB();
  const dump = {
    versao: 1,
    geradoEm: new Date().toISOString(),
    projetos: await db.projetos.toArray(),
    categorias: await db.categorias.toArray(),
    unidades: await db.unidades.toArray(),
    empresas: await db.empresas.toArray(),
    funcionarios: await db.funcionarios.toArray(),
    locais: await db.locais.toArray(),
    produtos: await db.produtos.toArray(),
    movimentacoes: await db.movimentacoes.toArray(),
  };
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_almoxarifado_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function restaurarBackup(json: string) {
  const data = JSON.parse(json) as Record<string, unknown[]>;
  const db = getDB();
  await db.transaction(
    "rw",
    [
      db.projetos,
      db.categorias,
      db.unidades,
      db.empresas,
      db.funcionarios,
      db.locais,
      db.produtos,
      db.movimentacoes,
    ],
    async () => {
      const put = async (
        table: { clear: () => Promise<void>; bulkPut: (rows: never[]) => Promise<unknown> },
        key: string,
      ) => {
        await table.clear();
        const rows = (data[key] ?? []) as never[];
        if (rows.length) await table.bulkPut(rows);
      };
      await put(db.projetos as never, "projetos");
      await put(db.categorias as never, "categorias");
      await put(db.unidades as never, "unidades");
      await put(db.empresas as never, "empresas");
      await put(db.funcionarios as never, "funcionarios");
      await put(db.locais as never, "locais");
      await put(db.produtos as never, "produtos");
      await put(db.movimentacoes as never, "movimentacoes");
    },
  );
}
