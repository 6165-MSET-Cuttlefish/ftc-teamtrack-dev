"""
Spot-check the fine-tuned adapter against a few held-out val clips.
Prints the model's caption next to the ground-truth caption for manual comparison.
"""
import json
from pathlib import Path

import torch
from transformers import AutoProcessor, BitsAndBytesConfig, Qwen2VLForConditionalGeneration
from peft import PeftModel
from qwen_vl_utils import process_vision_info

from prompts import SYSTEM_INSTRUCTION, USER_PROMPT
from train import build_messages

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "data" / "manifest.json"
ADAPTER_DIR = HERE / "data" / "adapter"
MODEL_ID = "Qwen/Qwen2-VL-2B-Instruct"


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    val_items = manifest["val"]

    processor = AutoProcessor.from_pretrained(MODEL_ID, min_pixels=112 * 112, max_pixels=336 * 336)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )
    base = Qwen2VLForConditionalGeneration.from_pretrained(
        MODEL_ID, quantization_config=bnb_config, torch_dtype=torch.bfloat16, device_map="auto"
    )
    model = PeftModel.from_pretrained(base, str(ADAPTER_DIR))
    model.eval()

    for item in val_items:
        messages = build_messages(item["frames"], None)
        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        image_inputs, _ = process_vision_info(messages)
        inputs = processor(text=[text], images=image_inputs, return_tensors="pt").to(model.device)

        with torch.no_grad():
            gen = model.generate(**inputs, max_new_tokens=200, do_sample=False)
        gen_trimmed = gen[:, inputs["input_ids"].shape[1]:]
        output_text = processor.batch_decode(gen_trimmed, skip_special_tokens=True)[0]

        print(f"\n=== {item['name']} ===")
        print(f"GROUND TRUTH: {item['caption']}")
        print(f"MODEL:        {output_text.strip()}")


if __name__ == "__main__":
    main()
