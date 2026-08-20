export type ID = string;

export type ProjetoStatus = "ATIVO" | "PAUSADO" | "ENCERRADO";
export type EmpresaTipo = "PROPRIA" | "TERCEIRA";
export type FuncionarioStatus = "ATIVO" | "INATIVO";
export type MovimentacaoTipo =
  | "ENTRADA"
  | "SAIDA"
  | "DEVOLUCAO"
  | "AJUSTE"
  | "TRANSFERENCIA";

export interface Projeto {
  id: ID;
  codigo: string;
  nome: string;
  empresa_id?: ID | null;
  status: ProjetoStatus;
  data_inicio?: string | null;
  data_fim?: string | null;
  observacao?: string | null;
}

export interface Categoria {
  id: ID;
  nome: string;
  ativo: boolean;
}

export interface Unidade {
  id: ID;
  sigla: string;
  descricao: string;
  ativo: boolean;
}

export interface Empresa {
  id: ID;
  nome: string;
  tipo: EmpresaTipo;
  ativo: boolean;
}

export interface Funcionario {
  id: ID;
  matricula?: string | null;
  nome: string;
  funcao?: string | null;
  encarregado_id?: ID | null;
  empresa_id?: ID | null;
  status: FuncionarioStatus;
}

export interface Local {
  id: ID;
  codigo?: string | null;
  nome: string;
  local_pai_id?: ID | null;
  ativo: boolean;
}

export interface Produto {
  id: ID;
  codigo?: string | null;
  nome: string;
  descricao?: string | null;
  categoria_id?: ID | null;
  unidade_id?: ID | null;
  marca?: string | null;
  modelo?: string | null;
  estoque_minimo: number;
  ativo: boolean;
}

export interface Movimentacao {
  id: ID;
  projeto_id: ID;
  data: string; // ISO yyyy-mm-dd
  tipo: MovimentacaoTipo;
  produto_id: ID;
  quantidade: number; // sempre positivo
  sinal?: 1 | -1; // usado por AJUSTE / TRANSFERENCIA
  funcionario_id?: ID | null;
  encarregado_id?: ID | null;
  empresa_id?: ID | null;
  local_id?: ID | null;
  local_destino_id?: ID | null;
  observacao?: string | null;
}

export interface EstoqueItem {
  produto: Produto;
  unidade?: Unidade;
  categoria?: Categoria;
  estoque: number;
  minimo: number;
  baixo: boolean;
}
