"""API 요청/응답 Pydantic 스키마."""
from pydantic import BaseModel


class InstructionIn(BaseModel):
    instruction: str
    participant: str = "guest"
