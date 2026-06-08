from dataclasses import dataclass, field


@dataclass
class Category:
    id: str
    name: str
    description: str
    item_type: str  # "file" | "folder" | "both"
    extensions: list[str] = field(default_factory=list)
    min_confidence: str = "medium"  # "low" | "medium" | "high"


@dataclass
class ClassificationScore:
    item_id: str
    category_id: str
    confidence: float
