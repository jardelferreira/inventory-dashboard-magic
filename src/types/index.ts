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
  empresa_id?: ID | null | undefined;
  status: ProjetoStatus;
  data_inicio?: string | null | undefined;
  data_fim?: string | null | undefined;
  observacao?: string | null | undefined;
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
  matricula?: string | null | undefined;
  nome: string;
  funcao?: string | null | undefined;
  encarregado_id?: ID | null | undefined;
  empresa_id?: ID | null | undefined;
  status: FuncionarioStatus;
}

export interface Local {
  id: ID;
  codigo?: string | null | undefined;
  nome: string;
  local_pai_id?: ID | null | undefined;
  ativo: boolean;
}

export interface Produto {
  id: ID;
  codigo?: string | null | undefined;
  nome: string;
  descricao?: string | null | undefined;
  categoria_id?: ID | null | undefined;
  unidade_id?: ID | null | undefined;
  marca?: string | null | undefined;
  modelo?: string | null | undefined;
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
  sinal?: (1 | -1) | undefined; // usado por AJUSTE / TRANSFERENCIA
  funcionario_id?: ID | null | undefined;
  encarregado_id?: ID | null | undefined;
  empresa_id?: ID | null | undefined;
  local_id?: ID | null | undefined;
  local_destino_id?: ID | null | undefined;
  movimentacao_origem_id?: ID | null | undefined; // devolução vinculada a uma saída
  observacao?: string | null | undefined;
}

export interface EstoqueItem {
  produto: Produto;
  unidade?: Unidade | undefined;
  categoria?: Categoria | undefined;
  estoque: number;
  minimo: number;
  baixo: boolean;
}
