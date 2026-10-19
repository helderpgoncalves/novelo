from pydantic import BaseModel, EmailStr, Field, field_validator

from novelo.features.users.schemas import Locale

PASSWORD_MIN = 10


def _check_password(value: str) -> str:
    if value.strip() != value or len(value) < PASSWORD_MIN:
        raise ValueError(f"Password must be at least {PASSWORD_MIN} characters with no surrounding spaces")
    return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    remember_me: bool = True


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)
    name: str | None = Field(default=None, max_length=120)
    remember_me: bool = True
    locale: Locale = "pt-PT"

    _pw = field_validator("password")(_check_password)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    locale: Locale = "pt-PT"  # idioma do email se a conta ainda não tiver preferência


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(max_length=128)

    _pw = field_validator("password")(_check_password)


class ChangePasswordRequest(BaseModel):
    current_password: str | None = Field(default=None, max_length=128)
    new_password: str = Field(max_length=128)

    _pw = field_validator("new_password")(_check_password)


class AuthConfig(BaseModel):
    google_enabled: bool
    registration_open: bool
    password_min_length: int = PASSWORD_MIN


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
