from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Literal

from flask import Flask, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


InputType = Literal["TEXT", "AUDIO"]


@dataclass
class Suggestion:
    policyName: str
    suggestedActivities: list[str]
    suggestedTransitions: list[dict]
    suggestedRoles: list[str]
    suggestedForms: list[str]
    createdAt: str


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _basic_process_interpreter(text: str) -> Suggestion:
    # MVP: heurístico simple para demostrar valor. Luego se reemplaza por NLP/LLM.
    t = (text or "").strip().lower()

    policy = "Política sugerida"
    if "solicitud" in t:
        policy = "Proceso de atención de solicitud"
    elif "compra" in t or "pedido" in t:
        policy = "Proceso de gestión de pedidos"

    activities = [
        "Registrar solicitud",
        "Validar información",
        "Revisar solicitud",
        "Aprobar o rechazar",
        "Ejecutar solicitud",
        "Notificar resultado",
        "Finalizar trámite",
    ]

    roles = ["Solicitante", "Recepción", "Área técnica", "Supervisor"]

    transitions = [
        {"from": "Registrar solicitud", "to": "Validar información"},
        {"from": "Validar información", "to": "Revisar solicitud"},
        {"from": "Revisar solicitud", "to": "Aprobar o rechazar"},
        {"from": "Aprobar o rechazar", "to": "Ejecutar solicitud", "condition": "APROBADA"},
        {"from": "Aprobar o rechazar", "to": "Notificar resultado", "condition": "RECHAZADA"},
        {"from": "Ejecutar solicitud", "to": "Notificar resultado"},
        {"from": "Notificar resultado", "to": "Finalizar trámite"},
    ]

    return Suggestion(
        policyName=policy,
        suggestedActivities=activities,
        suggestedTransitions=transitions,
        suggestedRoles=roles,
        suggestedForms=[],
        createdAt=_now_iso(),
    )


@app.post("/ai/process-suggestions/text")
def process_suggestions_text():
    payload = request.get_json(silent=True) or {}
    text = payload.get("text", "")
    suggestion = _basic_process_interpreter(text)
    return asdict(suggestion), 200


@app.get("/ai/health")
def health():
    return {"ok": True, "ts": _now_iso()}, 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)

