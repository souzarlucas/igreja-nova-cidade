from typing import Literal
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Money = int


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class UserInput(Model):
    email: str = Field(min_length=5, max_length=200)
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(default="", max_length=128)
    role: Literal["admin", "treasury", "presbytery", "ministry", "member"]
    ministry: str = Field(default="", max_length=100)
    financeAccess: bool = False

    @field_validator("email")
    @classmethod
    def email_valid(cls, value):
        import re

        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("E-mail inválido")
        return value.lower()


class Ministry(Model):
    name: str = Field(min_length=2, max_length=120)
    leader: str = Field(default="", max_length=120)
    volunteers: str = Field(default="", max_length=4000)
    area: str = Field(default="", max_length=100)
    description: str = Field(default="", max_length=4000)
    email: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=40)


class Member(Model):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=40)
    position: str = Field(default="", max_length=100)
    birth: str = Field(default="", max_length=10)
    notes: str = Field(default="", max_length=4000)

    @field_validator("birth")
    @classmethod
    def birthday(cls, v):
        if v:
            date.fromisoformat(v)
        return v


class Event(Model):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=4000)
    objective: str = Field(default="", max_length=4000)
    responsible: str = Field(min_length=2, max_length=120)
    team: str = Field(default="", max_length=1000)
    date: str = Field(max_length=10)
    time: str = Field(default="", max_length=5)
    end: str = Field(default="", max_length=16)
    location: str = Field(default="", max_length=200)
    amount: int = Field(default=0, ge=0, le=100_000_000_000)
    status: Literal["Programado", "Em andamento", "Concluído", "Atrasado"] = (
        "Programado"
    )

    @model_validator(mode="after")
    def validate_dates(self):
        start = date.fromisoformat(self.date)
        if self.time:
            datetime.strptime(self.time, "%H:%M")
        if self.end:
            end = datetime.fromisoformat(self.end)
            if end.date() < start:
                raise ValueError("Término anterior ao início")
            if self.time and end < datetime.fromisoformat(self.date + "T" + self.time):
                raise ValueError("Término anterior ao início")
        return self


class Budget(Model):
    year: int = Field(ge=2020, le=2100)
    month: int = Field(ge=0, le=12)
    area: str = Field(min_length=2, max_length=100)
    amount: int = Field(ge=0, le=100_000_000_000)


class Item(Model):
    description: str = Field(min_length=2, max_length=200)
    category: str = Field(min_length=2, max_length=100)
    amount: int = Field(gt=0, le=100_000_000_000)


class Expense(Model):
    name: str = Field(min_length=2, max_length=160)
    date: str = Field(max_length=10)
    amount: int = Field(gt=0, le=100_000_000_000)
    event: str = Field(default="", max_length=100)
    area: str = Field(min_length=2, max_length=100)
    notes: str = Field(default="", max_length=4000)
    justification: str = Field(min_length=10, max_length=4000)
    executionDetails: str = Field(min_length=10, max_length=4000)
    requestId: str = Field(default="", max_length=100)
    items: list[Item] = Field(default_factory=list, min_length=1, max_length=50)

    @model_validator(mode="after")
    def check(self):
        date.fromisoformat(self.date)
        if not self.items:
            self.items = [Item(description=self.name, category=self.area, amount=self.amount)]
        if sum(i.amount for i in self.items) != self.amount:
            raise ValueError("A soma dos itens deve corresponder ao valor total")
        return self


class Income(Model):
    name: str = Field(min_length=2, max_length=160)
    date: str = Field(max_length=10)
    amount: int = Field(gt=0, le=100_000_000_000)
    category: str = Field(min_length=2, max_length=100)
    notes: str = Field(default="", max_length=4000)

    @field_validator("date")
    @classmethod
    def valid_date(cls, v):
        date.fromisoformat(v)
        return v


class ResourceRequest(Model):
    name: str = Field(min_length=2, max_length=160)
    date: str = Field(max_length=10)
    event: str = Field(default="", max_length=100)
    area: str = Field(min_length=2, max_length=100)
    justification: str = Field(min_length=20, max_length=4000)
    objective: str = Field(min_length=10, max_length=4000)
    priority: Literal["Normal", "Alta", "Baixa"] = "Normal"
    amount: int = Field(gt=0, le=100_000_000_000)
    items: list[Item] = Field(default_factory=list, min_length=1, max_length=50)

    @model_validator(mode="after")
    def valid_total(self):
        date.fromisoformat(self.date)
        if not self.items:
            self.items = [Item(description=self.name, category=self.area, amount=self.amount)]
        if sum(i.amount for i in self.items) != self.amount:
            raise ValueError("Total dos itens inválido")
        return self


class Settings(Model):
    deadline: int = Field(ge=1, le=31)


SCHEMAS = {
    "ministries": Ministry,
    "members": Member,
    "events": Event,
    "budgets": Budget,
    "expenses": Expense,
    "incomes": Income,
    "requests": ResourceRequest,
    "settings": Settings,
}
