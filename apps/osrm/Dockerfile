# syntax=docker/dockerfile:1.7
# OSRM autocontido: descarrega o OpenStreetMap de Portugal (Geofabrik, licença ODbL), recorta Guimarães e arredores,
# prepara o grafo (MLD) e serve /table e /route. Sem custos nem chaves. Contexto de build = apps/osrm.
# Atualizar os dados: `just osrm-refresh`. Ver docs/engenharia/rotas-reais.md.

FROM debian:bookworm-slim AS clip
RUN apt-get update && apt-get install -y --no-install-recommends osmium-tool curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# `latest` redireciona para o ficheiro datado mais recente; o nome datado fica registado em /data/SNAPSHOT.
ARG OSM_URL=https://download.geofabrik.de/europe/portugal-latest.osm.pbf
# lon_min,lat_min,lon_max,lat_max: o concelho de Guimarães com ~10 km de margem (as estradas na fronteira ligam-se).
ARG BBOX=-8.60,41.26,-8.00,41.66
WORKDIR /data
RUN curl -fsSL --retry 5 --retry-delay 5 -D headers.txt -o portugal.osm.pbf "$OSM_URL" \
    && (grep -i '^location:' headers.txt | tail -1 | tr -d '\r' || true) > SNAPSHOT \
    && osmium extract --bbox "$BBOX" --strategy=smart -o area.osm.pbf portugal.osm.pbf \
    && osmium fileinfo -e area.osm.pbf | head -20 > FILEINFO \
    && rm portugal.osm.pbf headers.txt

FROM ghcr.io/project-osrm/osrm-backend:v26.4.0 AS prepare
WORKDIR /data
COPY --from=clip /data/area.osm.pbf /data/SNAPSHOT /data/
# Perfil da viatura de têxtil (sem compactação): o `car.lua` oficial com as dimensões de uma furgoneta/camião ligeiro
# (PRESSUPOSTO, ver docs/engenharia/rotas-reais.md), para respeitar maxheight/maxwidth/maxweight das vias.
RUN sed -e 's/vehicle_height = 2.0/vehicle_height = 2.8/' \
        -e 's/vehicle_width = 1.9/vehicle_width = 2.1/' \
        -e 's/vehicle_length = 4.8/vehicle_length = 6.0/' \
        -e 's/vehicle_weight = 2000/vehicle_weight = 3500/' /opt/car.lua > /opt/novelo-van.lua \
    && test "$(diff /opt/car.lua /opt/novelo-van.lua | grep -c '^>')" = 4
RUN osrm-extract -p /opt/novelo-van.lua /data/area.osm.pbf \
    && osrm-partition /data/area.osrm \
    && osrm-customize /data/area.osrm \
    && rm /data/area.osm.pbf

FROM ghcr.io/project-osrm/osrm-backend:v26.4.0
WORKDIR /data
COPY --from=prepare /data /data
EXPOSE 5000
# Tabelas grandes (rotas com muitas paragens) e rotas com muitos pontos; o adaptador também divide em blocos.
CMD ["osrm-routed", "--algorithm", "mld", "--max-table-size", "500", "--max-viaroute-size", "500", "--port", "5000", "/data/area.osrm"]
