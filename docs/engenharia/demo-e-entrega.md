# Demo e entrega

A demo dura 2 minutos e 10 segundos dentro do pitch e percorre a história inteira, do saco ao fio, com o júri a participar.

## Guião da demo

| Momento | Tempo | O que acontece |
| --- | --- | --- |
| 1. Cenários | 30 s | Mapa de Guimarães com a procura por freguesia. Cenário A (contentores de rua em todo o lado) contra Cenário B (mistura de modos). Pausa de 3 s no €/t. |
| 2. "E se...?" | 40 s | Pedimos a um jurado uma pergunta. O Novelo mostra "Entendi: ...", corre o otimizador e explica a diferença em números. |
| 3. Do saco ao fio | 40 s | Foto de uma peça real e da etiqueta: estado, composição e marca. A peça entra num lote; um jurado lê o QR do saco com o telemóvel e abre o passaporte. O Sankey engrossa em direto e o lote aparece na bolsa de fibra. |
| 4. Relatório RAP | 20 s | Um clique e abre o PDF: custo por tonelada por tipo de território, toneladas por fibra, marcas mais encontradas. |

## Dados da demo

- Cenários A e B pré-calculados e guardados (ecrã Cenários); a demo nunca depende de correr a otimização inteira ao vivo.
- Cinco perguntas "E se...?" de reserva, testadas e em cache, caso o jurado não queira perguntar ou a rede falhe. A pergunta do jurado corre a sério.
- Um lote de demonstração já com histórico (recolhido, triado), para o passaporte não aparecer vazio; a peça em palco junta-se a ele.
- A peça para a triagem: uma camisola com etiqueta legível, testada antes no mesmo telemóvel e com a mesma luz.
- Um relatório RAP pré-gerado no portátil, caso a geração demore.

## Checklist de entrega

- [ ] https://novelo.helder.si a funcionar fora da rede do evento
- [ ] `just check` verde e a stack de produção testada com `just build`
- [ ] Cenários A e B carregam em menos de 2 segundos
- [ ] "E se...?" responde em menos de 15 segundos; perguntas de reserva em cache
- [ ] QR impresso no saco da demo e testado com dois telemóveis diferentes
- [ ] Relatório RAP gera em menos de 10 segundos; cópia pré-gerada no portátil
- [ ] Vídeo de 60 s da demo no portátil e num segundo dispositivo
- [ ] Slides finais exportados em PDF
- [ ] Números da frase-âncora iguais nos slides, na demo, no vídeo e no relatório
- [ ] Repositório público ou partilhado, com README e instruções para correr
- [ ] Fontes dos dados no README, nos slides e no relatório
- [ ] Página do projeto atualizada com capa, avatar, teaser e descrição
- [ ] 3 ensaios cronometrados feitos
- [ ] Quem responde a que tema nas perguntas do júri decidido
