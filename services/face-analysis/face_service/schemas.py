from pydantic import BaseModel, ConfigDict, Field, field_validator


class ImageInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=256)
    name: str = Field(min_length=1, max_length=1024)
    previewUrl: str = Field(max_length=4096)
    # Trusted upstream modification time/checksum, never an arbitrary browser value.
    version: str | None = Field(default=None, min_length=1, max_length=512)
    originalWidth: int | None = Field(default=None, gt=0, le=100000)
    originalHeight: int | None = Field(default=None, gt=0, le=100000)


class JobInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    albumId: str = Field(min_length=1, max_length=256)
    images: list[ImageInput] = Field(min_length=1, max_length=20000)

    @field_validator("images")
    @classmethod
    def unique_images(cls, images: list[ImageInput]) -> list[ImageInput]:
        if len({image.id for image in images}) != len(images):
            raise ValueError("Image IDs must be unique within an album")
        return images
