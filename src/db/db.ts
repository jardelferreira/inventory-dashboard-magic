import Dexie, { type Table } from "dexie";
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

export class AlmoxarifadoDB extends Dexie {
  projetos!: Table<Projeto, string>;
  categorias!: Table<Categoria, string>;
  unidades!: Table<Unidade, string>;
  empresas!: Table<Empresa, string>;
  funcionarios!: Table<Funcionario, string>;
  locais!: Table<Local, string>;
  produtos!: Table<Produto, string>;
  movimentacoes!: Table<Movimentacao, string>;

  constructor() {
    super("almoxarifado");
    this.version(1).stores({
      projetos: "id, codigo, nome, status",
      categorias: "id, nome, ativo",
      unidades: "id, sigla, ativo",
      empresas: "id, nome, tipo, ativo",
      funcionarios: "id, nome, matricula, empresa_id, encarregado_id, status",
      locais: "id, nome, codigo, local_pai_id, ativo",
      produtos: "id, nome, codigo, categoria_id, unidade_id, ativo",
      movimentacoes:
        "id, projeto_id, data, tipo, produto_id, funcionario_id, encarregado_id, empresa_id, local_id",
    });
  }
}

let _db: AlmoxarifadoDB | null = null;

/** Acesso ao banco local. Só existe no navegador. */
export function getDB(): AlmoxarifadoDB {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB só está disponível no navegador");
  }
  if (!_db) _db = new AlmoxarifadoDB();
  return _db;
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
