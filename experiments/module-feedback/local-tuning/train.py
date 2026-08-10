"""
QLoRA fine-tune of Qwen2-VL-2B-Instruct on the local FTC mechanism dataset.

Run: .venv\\Scripts\\python.exe train.py
Reads data/manifest.json (from prepare_dataset.py), writes the LoRA adapter to
data/adapter/.
"""
import json
from pathlib import Path

import torch
from transformers import (
    AutoProcessor,
    BitsAndBytesConfig,
    Qwen2VLForConditionalGeneration,
    TrainingArguments,
    Trainer,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from qwen_vl_utils import process_vision_info

from prompts import SYSTEM_INSTRUCTION, USER_PROMPT

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "data" / "manifest.json"
ADAPTER_OUT = HERE / "data" / "adapter"
MODEL_ID = "Qwen/Qwen2-VL-2B-Instruct"

MAX_LEN = 2048


def build_messages(frames: list[str], caption: str | None):
    frame_uris = [f"file://{Path(f).resolve().as_posix()}" for f in frames]
    user_turn = {
        "role": "user",
        "content": [{"type": "image", "image": uri} for uri in frame_uris]
        + [{"type": "text", "text": USER_PROMPT}],
    }
    messages = [
        {"role": "system", "content": [{"type": "text", "text": SYSTEM_INSTRUCTION}]},
        user_turn,
    ]
    if caption is not None:
        messages.append(
            {"role": "assistant", "content": [{"type": "text", "text": caption}]}
        )
    return messages


class ClipDataset(torch.utils.data.Dataset):
    def __init__(self, items, processor):
        self.items = items
        self.processor = processor

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        item = self.items[idx]
        frames, caption = item["frames"], item["caption"]

        prompt_only_msgs = build_messages(frames, None)
        full_msgs = build_messages(frames, caption)

        prompt_text = self.processor.apply_chat_template(
            prompt_only_msgs, tokenize=False, add_generation_prompt=True
        )
        full_text = self.processor.apply_chat_template(
            full_msgs, tokenize=False, add_generation_prompt=False
        )

        image_inputs, _ = process_vision_info(full_msgs)

        full_enc = self.processor(
            text=[full_text],
            images=image_inputs,
            videos=None,
            padding=False,
            truncation=True,
            max_length=MAX_LEN,
            return_tensors="pt",
        )
        prompt_enc = self.processor(
            text=[prompt_text],
            images=image_inputs,
            videos=None,
            padding=False,
            truncation=True,
            max_length=MAX_LEN,
            return_tensors="pt",
        )

        input_ids = full_enc["input_ids"][0]
        labels = input_ids.clone()
        prompt_len = prompt_enc["input_ids"].shape[1]
        labels[:prompt_len] = -100

        # pixel_values/image_grid_thw are concatenated across images with no
        # per-example batch dim (unlike input_ids/attention_mask), so they must
        # NOT be indexed with [0] the way the text tensors are.
        out = {}
        for k, v in full_enc.items():
            out[k] = v if k in VISION_KEYS else v[0]
        out["labels"] = labels
        return out


VISION_KEYS = {"pixel_values", "image_grid_thw", "pixel_values_videos", "video_grid_thw"}


def collate(batch):
    assert len(batch) == 1, "this collator only supports batch_size=1 (variable image token counts)"
    item = batch[0]
    out = {}
    for k, v in item.items():
        out[k] = v if k in VISION_KEYS else v.unsqueeze(0)
    return out


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    train_items, val_items = manifest["train"], manifest["val"]
    print(f"train={len(train_items)} val={len(val_items)}")

    processor = AutoProcessor.from_pretrained(MODEL_ID, min_pixels=112 * 112, max_pixels=336 * 336)

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )
    model = Qwen2VLForConditionalGeneration.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        torch_dtype=torch.bfloat16,
        device_map="auto",
    )
    model = prepare_model_for_kbit_training(model)

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    train_ds = ClipDataset(train_items, processor)
    val_ds = ClipDataset(val_items, processor)

    args = TrainingArguments(
        output_dir=str(HERE / "data" / "checkpoints"),
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=8,
        num_train_epochs=3,
        learning_rate=1e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        logging_steps=5,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        bf16=True,
        gradient_checkpointing=True,
        report_to=[],
        remove_unused_columns=False,
    )

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        data_collator=collate,
    )
    trainer.train()

    ADAPTER_OUT.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(ADAPTER_OUT))
    processor.save_pretrained(str(ADAPTER_OUT))
    print(f"Saved adapter to {ADAPTER_OUT}")


if __name__ == "__main__":
    main()
