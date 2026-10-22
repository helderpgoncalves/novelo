"""Valores por omissão da viatura dedicada, do estaleiro e do tratamento: um só sítio para os schemas e os pressupostos.

Cada valor tem a fonte em docs/engenharia/dados-e-modelo.md (tabela «Pressupostos»).
"""

from novelo.features.textile.references import RSU_TREATMENT_EUR_PER_T

# Estaleiro Operacional da Vitrus, Rua das Lameiras, Polvoreira (confirmado pelo mentor a 22 out 2026). Coordenadas do
# link «Localização GPS» do estaleiro na página de contactos da Vitrus (vitrusambiente.pt/contactos, Google Maps,
# ponto da Street View à porta do estaleiro): dado da Vitrus.
DEPOT_LAT, DEPOT_LON = 41.41823, -8.30164

# Viatura nova dedicada ao têxtil, de caixa fechada e sem compactação (Vitrus, 22 out 2026: «aquisição de um meio
# novo de recolha»). Preço: 42 500 € sem IVA, adjudicação de «um veículo pesado de mercadorias com caixa fechada» do
# Município de Vila Nova de Gaia (lote VII, anúncio TED 338951-2024, adjudicação TED 72690-2025, MBP Automóveis
# Portugal); no mesmo concurso os ligeiros de mercadorias saíram a 41 338 € (lote V) e a 44 300 € (lote VI) por
# viatura. Pressuposto até a Vitrus ter um orçamento.
VEHICLE_CAPEX_EUR = 42_500.0
VEHICLE_LIFETIME_YEARS = 8.0  # vida útil para anualizar o investimento; pressuposto da equipa
VEHICLE_CAPACITY_T = 2.0  # carga útil de uma caixa fechada até ~5 t de peso bruto; pressuposto (ficha técnica)
VEHICLE_SPEED_KMH = 30.0  # velocidade média em recolha (estrada municipal e paragens curtas); pressuposto
SHIFT_HOURS = 7.0  # horas úteis por turno (8 h menos descarga e pausas); pressuposto
DOOR_STOP_MINUTES = 2.0  # parar, levar o saco fechado da porta e seguir; pressuposto
SITE_STOP_MINUTES = 10.0  # paragem num local com vários sacos (ponto existente, escola); pressuposto
ON_DEMAND_EVERY_WEEKS = 2  # uma ronda porta a porta por freguesia a cada 2 semanas; pressuposto

# Tratamento do indiferenciado evitado por tonelada desviada: 40 €/t TGR + 65,64 €/t Resinorte (Vitrus, 22 out 2026).
TREATMENT_EUR_PER_T = RSU_TREATMENT_EUR_PER_T
