import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/common/Combobox";
import { useDados, useProjetoAtivoId } from "@/hooks/useAppData";
import { repo } from "@/services/repo";
import { estoqueDoProduto } from "@/services/estoque";
import { hoje, num } from "@/utils/format";
import type { Movimentacao, MovimentacaoTipo } from "@/types";

export const Route = createFileRoute("/app/lancar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lançar Movimentação — Saída, Entrada, Devolução e Ajuste" },
      {
        name: "description",
        content:
          "Fluxo rápido para lançar saídas, entradas, devoluções, ajustes e transferências de materiais do almoxarifado.",
      },
      { property: "og:title", content: "Lançar Movimentação" },
      {
        property: "og:description",
        content: "Lançamento rápido de saída, entrada, devolução, ajuste e transferência.",
      },
    ],
  }),
  component: LancarPage,
});

type Campo =
  | "funcionario"
  | "encarregado"
  | "empresa"
  | "local"
  | "localDestino"
  | "sinal";

const CONFIG: Record<
  string,
  { tipo: MovimentacaoTipo; titulo: string; campos: Campo[]; descricao: string }
> = {
  saida: {
    tipo: "SAIDA",
    titulo: "Saída",
    descricao: "Retirada de material do almoxarifado. Diminui o estoque.",
    campos: ["funcionario", "encarregado", "empresa", "local"],
  },
  entrada: {
    tipo: "ENTRADA",
    titulo: "Entrada",
    descricao: "Recebimento de material. Aumenta o estoque.",
    campos: ["empresa", "local"],
  },
  devolucao: {
    tipo: "DEVOLUCAO",
    titulo: "Devolução",
    descricao: "Retorno de material ao almoxarifado. Aumenta o estoque.",
    campos: ["funcionario", "empresa", "local"],
  },
  ajuste: {
    tipo: "AJUSTE",
    titulo: "Ajuste",
    descricao: "Correção de inventário. Exige motivo e confirmação.",
    campos: ["sinal", "local"],
  },
  transferencia: {
    tipo: "TRANSFERENCIA",
    titulo: "Transferência",
    descricao: "Move material entre locais.",
    campos: ["local", "localDestino"],
  },
};

function LancarPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase">Lançar movimentação</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o tipo e registre em poucos cliques.
        </p>
      </div>
      <Tabs defaultValue="saida">
        <TabsList>
          {Object.entries(CONFIG).map(([k, c]) => (
            <TabsTrigger key={k} value={k}>
              {c.titulo}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.keys(CONFIG).map((k) => (
          <TabsContent key={k} value={k}>
            <Formulario modo={k} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Formulario({ modo }: { modo: string }) {
  const cfg = CONFIG[modo]!;
  const [projetoId] = useProjetoAtivoId();
  const dados = useDados(projetoId);
  const [data, setData] = useState(hoje());
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [encarregadoId, setEncarregadoId] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [localId, setLocalId] = useState<string | null>(null);
  const [localDestinoId, setLocalDestinoId] = useState<string | null>(null);
  const [sinal, setSinal] = useState<1 | -1>(1);
  const [observacao, setObservacao] = useState("");

  const produtos = useMemo(
    () => (dados?.produtos ?? []).filter((p) => p.ativo),
    [dados],
  );

  if (!dados || !projetoId)
    return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const produto = dados.produtos.find((p) => p.id === produtoId);
  const unidade = produto?.unidade_id
    ? dados.unidades.find((u) => u.id === produto.unidade_id)
    : undefined;
  const atual = produtoId ? estoqueDoProduto(dados.movimentacoes, produtoId) : 0;
  const qtd = Number(quantidade.replace(",", ".")) || 0;
  const efeitoQtd =
    cfg.tipo === "SAIDA" ? -qtd : cfg.tipo === "AJUSTE" ? sinal * qtd : cfg.tipo === "TRANSFERENCIA" ? 0 : qtd;
  const resultante = atual + efeitoQtd;

  const limpar = () => {
    setProdutoId(null);
    setQuantidade("");
    setObservacao("");
  };

  const salvar = async () => {
    if (!produtoId) {
      toast.error("Selecione um produto");
      return;
    }
    if (!(qtd > 0)) {
      toast.error("Informe uma quantidade maior que zero");
      return;
    }
    if (!data) {
      toast.error("Informe a data");
      return;
    }
    if (cfg.tipo === "TRANSFERENCIA" && (!localId || !localDestinoId)) {
      toast.error("Informe local de origem e destino");
      return;
    }
    if (cfg.tipo === "AJUSTE" && !observacao.trim()) {
      toast.error("Informe o motivo do ajuste");
      return;
    }
    if (resultante < 0 && cfg.tipo !== "TRANSFERENCIA") {
      const ok = confirm(
        `Esta operação deixa o estoque negativo (${num(resultante)} ${unidade?.sigla ?? ""}). Confirmar mesmo assim?`,
      );
      if (!ok) return;
    }
    if (cfg.tipo === "AJUSTE" && !confirm("Confirmar ajuste de estoque?")) return;

    const base: Omit<Movimentacao, "id"> = {
      projeto_id: projetoId,
      data,
      tipo: cfg.tipo,
      produto_id: produtoId,
      quantidade: qtd,
      sinal: cfg.tipo === "AJUSTE" ? sinal : 1,
      funcionario_id: funcionarioId,
      encarregado_id: encarregadoId,
      empresa_id: empresaId,
      local_id: localId,
      observacao: observacao.trim() || null,
    };

    if (cfg.tipo === "TRANSFERENCIA") {
      await repo.saveMovimentacao({
        ...base,
        sinal: -1,
        local_id: localId,
        observacao: `Transferência para ${dados.locais.find((l) => l.id === localDestinoId)?.nome ?? ""}. ${observacao}`.trim(),
      });
      await repo.saveMovimentacao({
        ...base,
        sinal: 1,
        local_id: localDestinoId,
        observacao: `Transferência de ${dados.locais.find((l) => l.id === localId)?.nome ?? ""}. ${observacao}`.trim(),
      });
    } else {
      await repo.saveMovimentacao(base);
    }
    toast.success(`${cfg.titulo} registrada`);
    limpar();
  };

  const opt = <T extends { id: string; nome: string }>(arr: T[]) =>
    arr.map((x) => ({ value: x.id, label: x.nome }));
  const funcAtivos = dados.funcionarios.filter((f) => f.status === "ATIVO");
  const empAtivas = dados.empresas.filter((e) => e.ativo);
  const locAtivos = dados.locais.filter((l) => l.ativo);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{cfg.titulo}</CardTitle>
          <p className="text-sm text-muted-foreground">{cfg.descricao}</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Quantidade {unidade ? `(${unidade.sigla})` : ""}</Label>
            <Input
              inputMode="decimal"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Produto</Label>
            <Combobox
              placeholder="Selecionar produto"
              value={produtoId}
              onChange={setProdutoId}
              opcoes={produtos.map((p) => ({
                value: p.id,
                label: p.nome,
                hint: dados.unidades.find((u) => u.id === p.unidade_id)?.sigla,
              }))}
            />
          </div>

          {cfg.campos.includes("sinal") && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tipo de ajuste</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={sinal === 1 ? "default" : "outline"}
                  onClick={() => setSinal(1)}
                >
                  Ajuste positivo
                </Button>
                <Button
                  type="button"
                  variant={sinal === -1 ? "default" : "outline"}
                  onClick={() => setSinal(-1)}
                >
                  Ajuste negativo
                </Button>
              </div>
            </div>
          )}
          {cfg.campos.includes("funcionario") && (
            <div className="space-y-1.5">
              <Label>Funcionário</Label>
              <Combobox
                placeholder="Selecionar"
                value={funcionarioId}
                onChange={setFuncionarioId}
                opcoes={opt(funcAtivos)}
              />
            </div>
          )}
          {cfg.campos.includes("encarregado") && (
            <div className="space-y-1.5">
              <Label>Encarregado</Label>
              <Combobox
                placeholder="Selecionar"
                value={encarregadoId}
                onChange={setEncarregadoId}
                opcoes={opt(funcAtivos)}
              />
            </div>
          )}
          {cfg.campos.includes("empresa") && (
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Combobox
                placeholder="Selecionar"
                value={empresaId}
                onChange={setEmpresaId}
                opcoes={opt(empAtivas)}
              />
            </div>
          )}
          {cfg.campos.includes("local") && (
            <div className="space-y-1.5">
              <Label>{cfg.tipo === "TRANSFERENCIA" ? "Local de origem" : "Local"}</Label>
              <Combobox
                placeholder="Selecionar"
                value={localId}
                onChange={setLocalId}
                opcoes={opt(locAtivos)}
              />
            </div>
          )}
          {cfg.campos.includes("localDestino") && (
            <div className="space-y-1.5">
              <Label>Local de destino</Label>
              <Combobox
                placeholder="Selecionar"
                value={localDestinoId}
                onChange={setLocalDestinoId}
                opcoes={opt(locAtivos)}
              />
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{cfg.tipo === "AJUSTE" ? "Motivo / observação" : "Observação"}</Label>
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <Button onClick={salvar}>Registrar {cfg.titulo.toLowerCase()}</Button>
            <Button variant="outline" onClick={limpar}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Resumo do produto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!produto ? (
            <p className="text-muted-foreground">Selecione um produto para ver o estoque.</p>
          ) : (
            <>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Produto</p>
                <p className="font-medium">{produto.nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Unidade</p>
                  <p className="font-medium">{unidade?.sigla ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Estoque mínimo</p>
                  <p className="num font-medium">{num(produto.estoque_minimo)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Estoque atual</p>
                  <p className="num font-display text-2xl font-bold">{num(atual)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Após lançamento</p>
                  <p
                    className={`num font-display text-2xl font-bold ${resultante < 0 ? "text-destructive" : ""}`}
                  >
                    {num(resultante)}
                  </p>
                </div>
              </div>
              {resultante < produto.estoque_minimo && (
                <Badge className="bg-warning text-warning-foreground">
                  Ficará abaixo do estoque mínimo
                </Badge>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
