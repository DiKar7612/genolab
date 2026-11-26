#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vision_check.py — глаза для текстового агента Pi-Cli.

Отправляет картинку на локальный роутер (llama-swap, 127.0.0.1:8080),
где её смотрит Qwen2.5-VL-3B-Instruct, и печатает текстовый ответ.
Роутер сам переключает модели: во время этого вызова 27B выгружается,
после простоя 120 с VL-модель выгружается тоже.

Примеры:
    python vision_check.py shot.png --preset ui
    python vision_check.py grid.png --preset palette
    python vision_check.py a.png b.png c.png   (пачка — один вызов модели)
"""
import argparse
import base64
import json
import sys
import time
import urllib.request
import mimetypes

ROUTER = "http://127.0.0.1:8080/v1/chat/completions"
MODEL = "vision"
RETRY_SECONDS = 45  # ждём подъём VL-модели после выгрузки (первый запрос ~15 c)

PRESETS = {
    "ui": (
        "Опиши скриншот интерфейса по списку: 1) все блоки и панели сверху вниз; "
        "2) читаемый текст (дословно, если крупный; если обрезан — где именно); "
        "3) кнопки и их подписи; 4) видимые ошибки, наложения, обрезы, пустые зоны. "
        "Не указывай точные пиксельные координаты и точные HEX-цвета — только состав."
    ),
    "palette": (
        "Опиши только цветовую схему: фон страницы (светлый/тёмный, тёплый/холодный), "
        "цвет основного текста (тёмный/светлый), акцентные элементы (кнопки, ссылки — "
        "тёплый рыжий/терракота или нет), общий тон. Кратко, списком."
    ),
    "layout360": (
        "Скриншот мобильной ширины. Проверь: 1) контент обрезан справа или снизу? "
        "2) сколько колонок в сетке карточек? 3) элементы накладываются друг на друга? "
        "4) навигация помещается или скроллится горизонтально? Ответь по пунктам, кратко."
    ),
    "creature": (
        "На картинке существо (SVG-рендер). Опиши: позу и пропорции (голова/тело/уши/хвост), "
        "окрас (светлый/насыщенный/выцветший), виден ли узор (пятна) и насколько явный, "
        "направление ушей (вверх/опущены), глаза (открыты/прищур). Кратко."
    ),
}


def encode(path):
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    mime = mimetypes.guess_type(path)[0] or "image/png"
    return f"data:{mime};base64,{b64}"


def build_content(images, prompt):
    content = [{"type": "text", "text": prompt}]
    for p in images:
        content.append({
            "type": "image_url",
            "image_url": {"url": encode(p)},
        })
    return content


def call(images, prompt):
    payload = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": build_content(images, prompt)}],
        "max_tokens": 1200,
        "temperature": 0.1,
    }).encode("utf-8")

    deadline = time.time() + RETRY_SECONDS
    last_err = None
    while True:
        req = urllib.request.Request(
            ROUTER, data=payload,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            last_err = e
            if time.time() >= deadline:
                raise
            print(f"[vision_check] модель просыпается ({e}); ждём...", file=sys.stderr)
            time.sleep(5)


def main():
    ap = argparse.ArgumentParser(description="Посмотреть на картинку через VL-модель")
    ap.add_argument("images", nargs="+", help="пути к png/jpg")
    ap.add_argument("--preset", default="ui", choices=PRESETS.keys())
    ap.add_argument("--prompt", default=None, help="свой вопрос вместо пресета")
    args = ap.parse_args()

    prompt = args.prompt or PRESETS[args.preset]
    if len(args.images) > 1:
        prompt += "\nКартинок несколько — отвечай по каждой отдельно, с номером."

    try:
        answer = call(args.images, prompt)
    except Exception as e:
        print(f"[vision_check] ОШИБКА: {e}", file=sys.stderr)
        print("Проверь: start_router.bat запущен? curl http://127.0.0.1:8080/v1/models")
        sys.exit(1)

    print(answer)


if __name__ == "__main__":
    main()
