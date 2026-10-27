from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.presets import PRESETS

# Also the signal.location.query value Qloo filters on (day-1 probe 3 checked "India").
MARKETS = {"US": "United States", "IN": "India", "UK": "United Kingdom"}
# Prices stay in the market's own currency end to end; tiers are relative to the comparables, so scoring doesn't care.
CURRENCY = {"US": "$", "IN": "₹", "UK": "£"}


class Variant(BaseModel):
    key: Literal["A", "B"]
    name: str = Field(min_length=1, max_length=60)
    positioning: str = Field(default="", max_length=300)
    price: float | None = Field(default=None, gt=0, le=1_000_000)  # None → use Brief.price
    comparable_weights: dict[str, float] | None = None  # qloo_id → weight; set on the confirm screen


class Segment(BaseModel):
    preset_id: str | None = None
    text: str | None = Field(default=None, min_length=3, max_length=200)

    @model_validator(mode="after")
    def one_of(self):
        if (self.preset_id is None) == (self.text is None):
            raise ValueError("give exactly one of preset_id or text")
        if self.preset_id is not None and self.preset_id not in PRESETS:
            raise ValueError(f"unknown preset: {self.preset_id}")
        return self


class Brief(BaseModel):
    description: str = Field(min_length=20, max_length=1000)
    category: Literal["beverage", "personal_care", "apparel", "app", "other"]
    price: float = Field(gt=0, le=1_000_000)
    variants: list[Variant] = Field(min_length=1, max_length=2)
    segments: list[Segment] = Field(min_length=1, max_length=3)
    market: Literal["US", "IN", "UK"] = "US"

    @model_validator(mode="after")
    def variant_keys(self):
        keys = [v.key for v in self.variants]
        if keys[0] != "A" or len(set(keys)) != len(keys):
            raise ValueError("variant keys must be unique and the first must be A")
        return self


class Comparable(BaseModel):
    qloo_id: str
    name: str
    weight: float = 1.0
    price: float
    resolved: bool = True
