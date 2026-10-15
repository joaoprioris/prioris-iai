"""Compare only safe failure metadata; never export assertion object bodies."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path("generated-artifacts/ex04-2")


def tap_failures(path):
    text = Path(path).read_text()
    headers = list(re.finditer(r"^(?:# Subtest:|not ok \d+ - ).+$", text, re.M))
    out = {}
    for i, h in enumerate(headers):
        if not h.group().startswith("not ok "):
            continue
        name = re.sub(r"^not ok \d+ - ", "", h.group())
        out[name] = text[h.end():headers[i+1].start() if i+1 < len(headers) else len(text)]
    return out


def spec_failures(path):
    text = Path(path).read_text().split("✖ failing tests:")[-1]
    headers = list(re.finditer(r"^✖ (.+) \([\d.]+ms\)$", text, re.M))
    out = {}
    for i, h in enumerate(headers):
        body = text[h.end():headers[i+1].start() if i+1 < len(headers) else len(text)]
        out[h.group(1)] = body.split("\ntest at ")[0]
    return out


def safe_value(value):
    value = value.strip().rstrip(",").strip("'\"")
    if re.fullmatch(r"(?:\d+(?:\.\d+)?|true|false|null|undefined)", value):
        return value
    if re.fullmatch(r"(?:MNT|CTN|PRF|IMP|FBK|OTO|CRS|0\.3\.[\w.-]+)", value):
        return value
    return "<object/string omitted>"


def signature(body):
    def field(name):
        m = re.search(r"^ {2,4}" + name + r": (.+)$", body, re.M)
        return m.group(1).rstrip(",").strip("'\"") if m else None
    error = field("error")
    message = re.search(r"\bError: ([A-Z_]+)", body)
    if error and re.fullmatch(r"[A-Z_]+", error):
        reason = error
    elif message:
        reason = message.group(1)
    elif "Command failed: git show HEAD:" in body:
        reason = "GIT_BASELINE_UNAVAILABLE"
    elif field("operator"):
        reason = "ASSERTION_MISMATCH"
    else:
        reason = "UNRESOLVED"
    frame = re.search(r"TestContext\.<anonymous>.*?((?:artifacts|scripts)/[^ )]+\.cjs:\d+:\d+)", body)
    result = {"reason": reason, "code": field("code"), "operator": field("operator"),
              "testSite": frame.group(1) if frame else None}
    for name in ("expected", "actual"):
        value = field(name)
        if value is not None:
            result[name] = safe_value(value)
    # Only safe metadata is hashed, never historical objects, secrets or messages.
    result["safeSha256"] = hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()
    return result


CATEGORIES = [
    ("fixture_risk", "Fixture sem qualificação/citação atual completa; risco não é comprovado por flag. Controle físico qualificado novo passa."),
    ("fixture_response", "Payload de fechamento antigo não inclui contrato atual de autoria; INVALID_MODEL_RESPONSE encapsula a recusa. A assinatura externa não prova isoladamente a causa interna."),
    ("expectation_syntax", "Regex de código exige ausência de espaços; a flag opt-in continua no código. Não comprova defeito funcional."),
    ("expectation_budget", "Esperado usa teto antigo de 1, fixture preserva teto de 5; divergência de saldo disponível não prova perda de consumo."),
    ("expectation_revision", "Asserção espera revisão antiga; não mede sozinha a proteção física. Controle físico qualificado novo passa."),
    ("fixture_response", "Envelope simulado de progressão não acompanha contrato atual; não relaxar o validador para aceitar."),
    ("fixture_response_rejected", "Resposta simulada é recusada por AUTONOMY_CONSTRAINT_FAILED; recusa preservada, não interpretada como indisponibilidade externa."),
    ("fixture_risk", "Fixture declara risco mas omite riskImpactEvidence atual; sem ela não se prova prioridade de risco."),
    ("fixture_risk", "Mesma lacuna de riskImpactEvidence no cenário organizacional; a primeira asserção de rota impede verificar as seguintes."),
    ("fixture_risk", "Primeira asserção exige CRS com fixture sem riskImpactEvidence; o restante da transição fica mascarado."),
    ("expectation_revision", "Asserção de revisão antiga falha antes de comprovar toda a ajuda. Não equivale a falha de conteúdo atual."),
    ("expectation_revision", "Observação existe, mas revisão esperada está fixada em 0.3.1; não concluir perda de observação por esse erro."),
    ("expectation_budget", "Número esperado usa teto antigo; não reduzir teto/reservas para tornar o teste verde."),
    ("non_comparable", "Base em /tmp falha em git show HEAD por ausência de repositório; EX04-1/2 falham na comparação integral do contrato, antes da asserção de revisão antiga. Causas diferentes/mascaramento; comparação anterior de nomes não sustentava equivalência."),
    ("different_failure_site", "Base atinge asserção de saldo; EX04-1/2 falham antes, na revisão. Não demonstrado que o caminho posterior produz a mesma causa."),
]
if __name__ == "__main__":
    before = tap_failures("generated-artifacts/ex04/baseline-failures.tap")
    delivered = spec_failures("generated-artifacts/ex04/checks.tap")
    current = tap_failures(ROOT / "previous-15-current.tap")
    if len(before) != 15 or set(before) != set(delivered) or set(before) != set(current):
        raise RuntimeError("Failure sets not fully accounted for")
    rows = []
    for i, (name, body) in enumerate(before.items()):
        category, finding = CATEGORIES[i]
        rows.append({"test": name, "category": category, "finding": finding,
                     "beforeEX04": signature(body), "EX04_1": signature(delivered[name]),
                     "EX04_2": signature(current[name])})
    payload = {"scope": "Safe metadata and inspected fixtures; no private diagnostic objects exported.",
               "limitation": "Equal safe signatures support failure-site comparison, not proof of every internal cause or absence of product defects.",
               "rows": rows}
    (ROOT / "failure-comparison.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    lines = ["# Comparação das 15 falhas", "", "Base anterior → EX04-1 → EX04-2. Assinaturas só de metadados seguros; não de objetos.", ""]
    for i, row in enumerate(rows, 1):
        lines += [f"## {i}. {row['test']}", f"Categoria: {row['category']}. {row['finding']}"]
        for key in ("beforeEX04", "EX04_1", "EX04_2"):
            s = row[key]
            lines.append(f"- {key}: {s['reason']} / {s['code']} / {s['operator']}; "
                         f"{s.get('actual','—')} → esperado {s.get('expected','—')}; "
                         f"{s['testSite']}; assinatura `{s['safeSha256']}`.")
        lines.append("")
    (ROOT / "failure-comparison.md").write_text("\n".join(lines))
    print(json.dumps({"compared": len(rows), "categories": sorted(set(r["category"] for r in rows))}))
