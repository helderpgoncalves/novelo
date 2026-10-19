import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    avatar_url: str | None
    role: Literal["admin", "operator"]
    has_password: bool
    google_linked: bool
