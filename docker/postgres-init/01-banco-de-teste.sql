-- Roda só na primeira criação do volume. Cria o banco exclusivo da suíte de
-- testes (ela faz TRUNCATE em tudo e nunca pode usar o banco "barbearia").
CREATE DATABASE barbearia_test;
