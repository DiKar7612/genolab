@echo off
rem start_router.bat — запуск роутера моделей GenoLab (llama-swap)
rem Адрес для Pi-Cli и vision_check: http://127.0.0.1:8080/v1
rem Проверить модели после старта: curl http://127.0.0.1:8080/v1/models

cd /d F:\genolab\tools

echo Запуск llama-swap...
llama-swap.exe --config swap_config.yaml --port 8080

pause
