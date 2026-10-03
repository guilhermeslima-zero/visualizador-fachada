/* ============================================================================
   Gerador da fachada para o navegador (Three.js r128) — versão 2
   ----------------------------------------------------------------------------
   Lê a MESMA geometria do gerador do Blender: geometria-executivo.json, extraída
   do PDF vetorial (Revit) da arquiteta por Ferramentas/extrair_geometria_executivo.py.
   Nenhuma coordenada é escrita à mão aqui.

   Eixos: a geometria é montada com X = ao longo do bloco, Y = altura e
   Z = profundidade do JSON (0 = face frontal); o grupo raiz tem escala Z = -1,
   então no mundo a face posterior fica em Z = -8,93 e a câmera de frente fica
   em Z positivo. Coordenadas de câmera em index.html usam a profundidade do
   JSON e são convertidas por lá.
   ========================================================================== */

const ESP_PAREDE = 0.25;   // espessura da alvenaria de fachada (ESTIMATIVA)
const RECUO_JANELA = 0.1;  // plano da esquadria atrás da face externa (ESTIMATIVA)

// (largura, altura, bandeira superior, nº de folhas) — prancha de 24/09/2026
const TIPOS = {
  J01: [1.4, 1.5, 0.32, 2], J02: [2.5, 1.5, 0.4, 2], J03: [0.25, 1.0, 0, 1],
  J04: [1.23, 1.0, 0.36, 2], J05: [0.3, 0.52, 0, 1], J06: [1.8, 1.3, 0.4, 2],
};

/* ------------------------------------------------------------ texturas */
function texturaJuntas(THREE, cor, corJunta, larg, alt, opts = {}) {
  // uma placa por ladrilho da textura; repetida em metros via UV
  const px = 256;
  const cv = document.createElement("canvas");
  cv.width = px;
  cv.height = Math.round(px * (alt / larg)) || px;
  const g = cv.getContext("2d");
  g.fillStyle = cor;
  g.fillRect(0, 0, cv.width, cv.height);
  const pontos = opts.pontos || 0;
  for (let i = 0; i < pontos; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5 ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.12)";
    g.fillRect(Math.random() * cv.width, Math.random() * cv.height,
      1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const j = opts.junta ?? 2;
  if (j > 0) {
    g.fillStyle = corJunta;
    g.fillRect(0, 0, cv.width, j);
    g.fillRect(0, 0, j, cv.height);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / larg, 1 / alt);
  t.anisotropy = 4;
  return t;
}

/** UV em metros por projeção em caixa (como o uv_cubo do gerador do Blender). */
function uvMetros(geo) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay > ax && ay > az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax > az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[2 * i] = u; uv[2 * i + 1] = v;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

function criarModelo(G, CEN, THREE) {
  const BGU = THREE.BufferGeometryUtils;
  const raiz = new THREE.Group();
  raiz.name = "Fachada";
  // Os dados usam (x, profundidade, altura), destro com Z para cima. No Three.js
  // a altura vira Y; para continuar destro a profundidade precisa virar -Z.
  // Sem isto a fachada aparece espelhada (esquerda ↔ direita).
  raiz.scale.z = -1;

  const C = G.corpo;
  const L = C.comprimento, D = C.profundidade, ZB = C.z_base, ZT = C.z_topo;
  const faixas = [...new Set(G.faixas_frontal.map((f) => +f.z.toFixed(3)))]
    .filter((z) => z > ZB + 0.1).sort((a, b) => a - b);
  const Z_INF = Math.min(...faixas.filter((z) => z < 6)); // topo da faixa inferior
  const Z_SUP = Math.max(...faixas);                      // base da faixa superior

  // ---------------------------------------------------------------- materiais
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const tex = {
    granito: texturaJuntas(THREE, "#D9D7D2", "#8E8B85", 0.8, 0.905, { pontos: 2500, junta: 4 }),
    granito_preto: texturaJuntas(THREE, "#1C1D20", "#0E0E10", 0.9, 0.6, { pontos: 900, junta: 1 }),
    fulget: texturaJuntas(THREE, "#6B4A40", "#6B4A40", 0.5, 0.5, { pontos: 9000, junta: 0 }),
    pastilha: texturaJuntas(THREE, "#EDEDEA", "#B9BBBB", 0.05, 0.05, { junta: 18 }),
  };
  const mat = {
    zona: { faixa_sup: lam(0xffffff), central: lam(0xffffff), faixa_inf: lam(0xffffff),
      torres: lam(0xffffff), terreo: lam(0xffffff) },
    esquadria: new THREE.MeshPhongMaterial({ color: 0xc4c7c9, shininess: 60 }),
    vidro: new THREE.MeshPhongMaterial({ color: 0x8fa6a3, shininess: 120,
      transparent: true, opacity: 0.45, specular: 0x666666 }),
    vidroEscuro: new THREE.MeshPhongMaterial({ color: 0x25302f, shininess: 120, specular: 0x555555 }),
    acm: new THREE.MeshPhongMaterial({ color: 0x8e9c92, shininess: 40 }),
    brise: new THREE.MeshPhongMaterial({ color: 0xb9bdbf, shininess: 50 }),
    cobogo: lam(0xd8d6cf),
    interior: lam(0x2c2925),
    teto: lam(0xecebe6),
    laje: lam(0x7a7b78),
    pastilha: new THREE.MeshLambertMaterial({ map: tex.pastilha }),
    basePilar: lam(0x151517),
    porta: new THREE.MeshPhongMaterial({ color: 0x2e4f5e, shininess: 100 }),
    portaMadeira: lam(0xd2c4b2),
    granitina: lam(0xb4b0a6),
    grama: lam(0x6c8a45),
    asfalto: lam(0x45474a),
    calcada: lam(0xc4beb2),
    alerta: lam(0xc1562e),
    ok: lam(0x5b7a6a),
  };
  raiz.userData.mat = mat;
  raiz.userData.tex = tex;

  const grupo = (nome) => {
    const g = new THREE.Group();
    g.name = nome;
    raiz.add(g);
    return g;
  };
  const malha = (geo, m, nome, sombra = true) => {
    const o = new THREE.Mesh(geo, m);
    if (nome) o.name = nome;
    o.castShadow = sombra;
    o.receiveShadow = true;
    return o;
  };
  // caixa por limites (x0..x1, y0..y1 = profundidade, z0..z1 = altura), como no Python
  const caixaGeo = (x0, x1, y0, y1, z0, z1) =>
    new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0)
      .translate((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
  const caixa = (x0, x1, y0, y1, z0, z1, m, nome) =>
    malha(uvMetros(caixaGeo(x0, x1, y0, y1, z0, z1)), m, nome);
  const juntar = (geos) => BGU.mergeBufferGeometries(geos.map((g) =>
    g.index ? g.toNonIndexed() : g), false);

  // ---------------------------------------------------------------- corpo
  const gCorpo = grupo("Corpo");
  const vaosF = G.frontal.janelas.map((j) => [j.x0, j.x1, j.z0, j.z1]);
  const vaosP = G.posterior.janelas.map((j) => [j.x0, j.x1, j.z0, j.z1])
    .concat(G.posterior.cobogos.map((c) => [c.x0, c.x1, c.z0, c.z1]));

  /**
   * Parede de uma zona da fachada com os vãos reais (requadro com profundidade).
   *
   * Vão inteiro dentro da zona vira furo. Vão que cruza a borda de baixo ou de
   * cima vira ENTALHE no contorno da zona. Isso é necessário porque o topo das
   * janelas do 3º pavimento (12,372 m na extração do PDF) passa 2 cm da linha da
   * faixa superior (12,352 m): antes esses 33 vãos não eram recortados em zona
   * nenhuma e a janela ficava escondida atrás da parede. O entalhe mantém janela
   * e faixa exatamente onde o JSON diz, e evita furo tangente à borda externa,
   * que quebra a triangulação (earcut).
   */
  const EPS = 0.005;                 // 5 mm: abaixo disso, "encosta" na borda
  const recortados = new Set();
  function paredeComVaos(z0, z1, vaos, yFace) {
    const furos = [], deBaixo = [], deCima = [];
    vaos.forEach((v) => {
      const [, , c, d] = v;
      if (d <= z0 + EPS || c >= z1 - EPS) return;          // vão fora desta zona
      const cruzaBaixo = c <= z0 + EPS, cruzaCima = d >= z1 - EPS;
      if (cruzaBaixo && cruzaCima) {
        console.warn("Vão mais alto que a zona inteira — não recortado:", v, [z0, z1]);
        return;
      }
      recortados.add(v);
      if (cruzaBaixo) deBaixo.push(v);
      else if (cruzaCima) deCima.push(v);
      else furos.push(v);
    });
    const s = new THREE.Shape();
    s.moveTo(0, z0);
    deBaixo.sort((p, q) => p[0] - q[0]).forEach(([a, b, , d]) => {
      const topo = Math.min(d, z1);
      s.lineTo(a, z0); s.lineTo(a, topo); s.lineTo(b, topo); s.lineTo(b, z0);
    });
    s.lineTo(L, z0);
    s.lineTo(L, z1);
    deCima.sort((p, q) => q[0] - p[0]).forEach(([a, b, c]) => {
      const fundo = Math.max(c, z0);
      s.lineTo(b, z1); s.lineTo(b, fundo); s.lineTo(a, fundo); s.lineTo(a, z1);
    });
    s.lineTo(0, z1);
    s.lineTo(0, z0);
    furos.forEach(([a, b, c, d]) => {
      const h = new THREE.Path();
      h.moveTo(a, c); h.lineTo(a, d); h.lineTo(b, d); h.lineTo(b, c); h.lineTo(a, c);
      s.holes.push(h);
    });
    const geo = new THREE.ExtrudeGeometry(s, { depth: ESP_PAREDE, bevelEnabled: false });
    geo.translate(0, 0, yFace);
    return uvMetros(geo);
  }
  const zonas = [["faixa_inf", ZB, Z_INF], ["central", Z_INF, Z_SUP], ["faixa_sup", Z_SUP, ZT]];
  zonas.forEach(([zona, z0, z1]) => {
    const m = mat.zona[zona];
    gCorpo.add(malha(paredeComVaos(z0, z1, vaosF, 0), m, `Fachada_frontal_${zona}`));
    gCorpo.add(malha(paredeComVaos(z0, z1, vaosP, D - ESP_PAREDE), m, `Fachada_posterior_${zona}`));
    gCorpo.add(caixa(0, ESP_PAREDE, ESP_PAREDE, D - ESP_PAREDE, z0, z1, m, `Empena_oeste_${zona}`));
    gCorpo.add(caixa(L - ESP_PAREDE, L, ESP_PAREDE, D - ESP_PAREDE, z0, z1, m, `Empena_leste_${zona}`));
  });
  // validação: nenhum vão pode ficar sem recorte (era o bug das janelas do 3º pavimento)
  const semRecorte = vaosF.concat(vaosP).filter((v) => !recortados.has(v));
  if (semRecorte.length) console.warn(`${semRecorte.length} vão(s) sem recorte na parede:`, semRecorte);
  gCorpo.add(caixa(ESP_PAREDE + 0.01, L - ESP_PAREDE - 0.01, ESP_PAREDE + 0.01, D - ESP_PAREDE - 0.01,
    ZT - 0.55, ZT - 0.45, mat.laje, "Cobertura"));
  // forro do pilotis: termina em ZB e fica 1 cm para dentro. Antes subia até
  // ZB + 0,30 com as faces em y = 0 e y = D, coplanares com a faixa inferior
  // (z-fighting: a "barra serrilhada" acima do pilotis)
  gCorpo.add(caixa(0.01, L - 0.01, 0.01, D - 0.01, ZB - 0.02, ZB, mat.teto, "Laje_pilotis"));
  gCorpo.add(caixa(-0.02, L + 0.02, -0.02, D + 0.02, ZT, ZT + 0.03, mat.brise, "Rufo"));
  // interior escuro: dá profundidade às janelas
  gCorpo.add(caixa(ESP_PAREDE + 0.15, L - ESP_PAREDE - 0.15, ESP_PAREDE + 0.15,
    D - ESP_PAREDE - 0.15, ZB + 0.3, ZT - 0.6, mat.interior, "Interior"));

  // ---------------------------------------------------------------- esquadrias
  /** Geometria de uma tipologia: grupo 0 = alumínio, grupo 1 = vidro. */
  function geoJanela(tipo) {
    const [w, h, band, folhas] = TIPOS[tipo];
    const t = 0.04, d = 0.07;
    const al = [], vi = [];
    const b = (arr, x0, x1, y0, y1, z0, z1) => arr.push(caixaGeo(x0, x1, y0, y1, z0, z1));
    b(al, 0, w, -d / 2, d / 2, 0, t); b(al, 0, w, -d / 2, d / 2, h - t, h);
    b(al, 0, t, -d / 2, d / 2, 0, h); b(al, w - t, w, -d / 2, d / 2, 0, h);
    let topo = h - t;
    if (band) {
      const zt = h - band;
      b(al, t, w - t, -d / 2, d / 2, zt - t / 2, zt + t / 2);
      topo = zt - t / 2;
      b(vi, t, w - t, -0.004, 0.004, zt + t / 2, h - t);
      if (w > 1.6) b(al, w / 2 - 0.015, w / 2 + 0.015, -0.02, 0.02, zt, h - t);
    }
    if (folhas === 2) {
      const lf = (w - 2 * t) / 2 + 0.03, p = 0.035;
      [[t, -0.012], [w - t - lf, 0.012]].forEach(([xa, yy]) => {
        b(al, xa, xa + lf, yy - 0.012, yy + 0.012, t, t + p);
        b(al, xa, xa + lf, yy - 0.012, yy + 0.012, topo - p, topo);
        b(al, xa, xa + p, yy - 0.012, yy + 0.012, t, topo);
        b(al, xa + lf - p, xa + lf, yy - 0.012, yy + 0.012, t, topo);
        b(vi, xa + p, xa + lf - p, yy - 0.003, yy + 0.003, t + p, topo - p);
      });
    } else {
      b(vi, t, w - t, -0.004, 0.004, t, topo);
    }
    return BGU.mergeBufferGeometries([juntar(al), juntar(vi)], true);
  }
  const geosJanela = {};
  Object.keys(TIPOS).forEach((k) => (geosJanela[k] = geoJanela(k)));

  const gJanelas = grupo("Janelas");
  const AMB = ["quarto", "quarto", "sala"];
  ["frontal", "posterior"].forEach((fach) => {
    const andares = {};
    G[fach].janelas.forEach((j) => (andares[j.z0.toFixed(1)] ||= []).push(j));
    Object.keys(andares).sort((a, b) => a - b).forEach((chave, iPav) => {
      const fila = andares[chave].sort((a, b) => a.x0 - b.x0);
      fila.forEach((j, i) => {
        const o = malha(geosJanela[j.tipo], [mat.esquadria, mat.vidro],
          `${j.tipo}_${fach.slice(0, 4)}_p${iPav + 1}_${i + 1}`, false);
        if (fach === "frontal") o.position.set(j.x0, j.z0, RECUO_JANELA);
        else { o.position.set(j.x1, j.z0, D - RECUO_JANELA); o.rotation.y = Math.PI; }
        const [w, h] = TIPOS[j.tipo];
        const ud = { tipo: j.tipo, fachada: fach, pavimento: iPav + 1, largura: w, altura: h };
        if (fach === "frontal" && fila.length === 24) {
          const ap = Math.floor(i / 3), k = i % 3;
          ud.unidade = `${iPav + 1}0${ap + 1}`;
          ud.ambiente = AMB[ap % 2 === 1 ? 2 - k : k];
        }
        o.userData = ud;
        gJanelas.add(o);
      });
    });
  });

  // ---------------------------------------------------------------- cobogós
  const gCobogos = grupo("Cobogos");
  const geosCob = {};
  G.posterior.cobogos.forEach((c, i) => {
    const w = c.x1 - c.x0, h = c.z1 - c.z0, chave = `${w.toFixed(2)}x${h.toFixed(2)}`;
    if (!geosCob[chave]) {
      const d = ESP_PAREDE - 0.02, t = 0.035, arr = [];
      const nx = Math.max(2, Math.round(w / 0.1)), nz = Math.max(2, Math.round(h / 0.1));
      for (let a = 0; a <= nx; a++) { const x = a * (w - t) / nx; arr.push(caixaGeo(x, x + t, 0, d, 0, h)); }
      for (let a = 0; a <= nz; a++) { const z = a * (h - t) / nz; arr.push(caixaGeo(0, w, 0, d, z, z + t)); }
      geosCob[chave] = juntar(arr);
    }
    const o = malha(geosCob[chave], mat.cobogo, `Cobogo_${i + 1}`, false);
    o.position.set(c.x0, c.z0, D - ESP_PAREDE + 0.01);
    gCobogos.add(o);
  });

  // ---------------------------------------------------------------- carenagens (ACM)
  const gCarenagens = grupo("Carenagens");
  const sal = G.carenagens_saliencia;
  ["frontal", "posterior"].forEach((fach) => {
    G[fach].carenagens.forEach((c, i) => {
      const e = 0.004, arr = [];
      const [ya, yb] = fach === "frontal" ? [-sal, 0] : [D, D + sal];
      const yf = fach === "frontal" ? [ya, ya + e] : [yb - e, yb];
      arr.push(caixaGeo(c.x0, c.x1, yf[0], yf[1], c.z0, c.z1));
      arr.push(caixaGeo(c.x0, c.x1, ya, yb, c.z1 - e, c.z1));
      arr.push(caixaGeo(c.x0, c.x0 + e, ya, yb, c.z0, c.z1));
      arr.push(caixaGeo(c.x1 - e, c.x1, ya, yb, c.z0, c.z1));
      for (let k = 0; k < 7; k++) {
        const yy = ya + (k + 0.5) * (yb - ya) / 7;
        arr.push(caixaGeo(c.x0, c.x1, yy - 0.012, yy + 0.012, c.z0, c.z0 + 0.05));
      }
      gCarenagens.add(malha(juntar(arr), mat.acm, `Carenagem_${fach.slice(0, 4)}_${i + 1}`));
    });
  });

  // ---------------------------------------------------------------- brises (aprovado 08/2024)
  const gBrises = grupo("Brises");
  const geosBrise = {}, geosBriseLonge = {};
  // Nível de detalhe: até DIST_BRISE, lâminas em 3D; além disso, as mesmas
  // molduras com as lâminas desenhadas numa textura com mipmaps. O contraste das
  // listras é moderado de propósito: com contraste alto (lâmina clara × fresta
  // escura) a textura também gerava moiré à distância; liso, o brise parecia
  // "não carregado" ao trocar de nível (relato de 02/10/2026).
  const DIST_BRISE = 40;
  const texBrise = (() => {
    const cv = document.createElement("canvas");
    cv.width = 8; cv.height = 32;
    const g = cv.getContext("2d");
    g.fillStyle = "#7d8285"; g.fillRect(0, 0, 8, 32);        // fresta (sombra)
    g.fillStyle = "#b9bdbf"; g.fillRect(0, 8, 8, 20);        // lâmina
    g.fillStyle = "#d3d6d7"; g.fillRect(0, 26, 8, 2);        // aresta iluminada
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 10);                                     // uma lâmina a cada 0,10 m
    t.anisotropy = 8;
    return t;
  })();
  const matBriseLonge = new THREE.MeshLambertMaterial({ map: texBrise });
  ["frontal", "posterior"].forEach((fach) => {
    G[fach].janelas.forEach((j, i) => {
      if (j.tipo === "J03") return;
      const w = j.x1 - j.x0, h = j.z1 - j.z0, chave = `${w.toFixed(2)}x${h.toFixed(2)}`;
      if (!geosBrise[chave]) {
        const arr = [caixaGeo(-0.04, 0, -0.16, 0, -0.02, h + 0.02),
          caixaGeo(w, w + 0.04, -0.16, 0, -0.02, h + 0.02)];
        const n = Math.max(3, Math.round(h / 0.1));
        for (let k = 0; k < n; k++) {
          const z = (k + 0.5) * h / n;
          arr.push(new THREE.BoxGeometry(w, 0.016, 0.12).rotateX(-0.5)
            .translate(w / 2, z, -0.08));
        }
        geosBrise[chave] = juntar(arr);
        // molduras laterais iguais às do nível detalhado + placa com a textura;
        // grupo 0 = alumínio liso, grupo 1 = lâminas desenhadas
        const placa = uvMetros(new THREE.BoxGeometry(w, h, 0.02).translate(w / 2, h / 2, -0.08));
        geosBriseLonge[chave] = BGU.mergeBufferGeometries([juntar(arr.slice(0, 2)), placa], true);
      }
      const lod = new THREE.LOD();
      lod.name = `Brise_${fach.slice(0, 4)}_${i + 1}`;
      lod.addLevel(malha(geosBrise[chave], mat.brise), 0);
      lod.addLevel(malha(geosBriseLonge[chave], [mat.brise, matBriseLonge]), DIST_BRISE);
      if (fach === "frontal") lod.position.set(j.x0, j.z0, 0);
      else { lod.position.set(j.x1, j.z0, D); lod.rotation.y = Math.PI; }
      gBrises.add(lod);
    });
  });

  // ---------------------------------------------------------------- torres de escada
  const gTorres = grupo("Torres");
  const T = G.torres;
  T.lista.forEach((t, k) => {
    const y0 = D - 0.05, y1 = D + T.saliencia;
    gTorres.add(caixa(t.x0, t.x1, y0, y1, 0, T.z_topo, mat.zona.torres, `Torre_${k + 1}`));
    // J05: no navegador ficam aplicados por fora da face (sem recorte)
    T.j05_por_face.forEach((p) => {
      [[t.x0 - 0.035, Math.PI / 2, y1 - p.d0], [t.x1 + 0.035, -Math.PI / 2, y1 - p.d1]]
        .forEach(([x, rot, y]) => {
          const o = malha(geosJanela.J05, [mat.esquadria, mat.vidroEscuro], "J05", false);
          o.position.set(x, p.z0, y);
          o.rotation.y = rot;
          o.userData = { tipo: "J05", fachada: "torre", largura: 0.3, altura: 0.52 };
          gTorres.add(o);
        });
    });
  });

  // ---------------------------------------------------------------- pilotis
  const gPilotis = grupo("Pilotis");
  G.pilares.forEach((p, i) => {
    const hx = p.larg / 2, hy = p.prof / 2;
    gPilotis.add(caixa(p.x - hx, p.x + hx, p.y - hy, p.y + hy, 0.2, ZB, mat.pastilha, `Pilar_${i + 1}`));
    gPilotis.add(caixa(p.x - hx - 0.01, p.x + hx + 0.01, p.y - hy - 0.01, p.y + hy + 0.01, 0, 0.2, mat.basePilar));
  });
  G.fechamentos_terreo.forEach((f, i) =>
    // topo 2 cm abaixo de ZB (encontra o forro) e face posterior 1 cm para dentro:
    // sem faces coplanares com o forro nem com a fachada posterior
    gPilotis.add(caixa(f.x0, f.x1, f.y0, Math.min(f.y1, D - 0.01), 0, ZB - 0.02, mat.zona.terreo,
      `Fechamento_${i + 1}`)));
  (G.frontal.portas_terreo || []).forEach((pt, i) => {
    const xm = (pt.x0 + pt.x1) / 2;
    const fe = G.fechamentos_terreo.filter((f) => f.x0 - 0.2 <= xm && xm <= f.x1 + 0.2);
    const y = fe.length ? Math.min(...fe.map((f) => f.y0)) : 4.08;
    gPilotis.add(caixa(pt.x0, pt.x1, y - 0.04, y + 0.01, pt.z0, Math.min(pt.z1, ZB - 0.02),
      pt.material === "vidro" ? mat.porta : mat.portaMadeira, `Porta_${i + 1}`));
  });

  // ---------------------------------------------------------------- terreno
  const gTerreno = grupo("Terreno");
  gTerreno.add(caixa(-0.6, L + 0.6, -0.6, D + 0.6, -0.05, 0, mat.granitina, "Piso_pilotis"));
  gTerreno.add(caixa(-120, L + 120, -110, 130, -0.15, -0.05, mat.grama, "Gramado"));
  gTerreno.add(caixa(-10, L + 10, D + 3.4, D + 21, -0.06, -0.02, mat.asfalto, "Estacionamento"));
  gTerreno.add(caixa(-12, L + 12, -9.5, -7.5, -0.06, -0.01, mat.calcada, "Calcada"));
  [14.0, 39.6, 65.0].forEach((xm) =>
    gTerreno.add(caixa(xm - 1.2, xm + 1.2, -7.5, -0.6, -0.06, -0.01, mat.calcada, "Acesso")));
  gTerreno.children.forEach((o) => (o.castShadow = false));

  // ---------------------------------------------------------------- cenários
  const ESPECIAIS = new Set(["granito", "granito_preto", "fulget", "pastilha"]);
  const corDe = (v) => (v && !ESPECIAIS.has(v) && !String(v).startsWith("#")
    ? CEN.tintas[v].hex : v);

  function pintar(m, valor) {
    if (ESPECIAIS.has(valor)) {
      m.map = tex[valor];
      m.color.set(0xffffff);
    } else {
      m.map = null;
      m.color.set(corDe(valor));
    }
    m.needsUpdate = true;
  }

  /** Aplica um cenário, com os ajustes de granito/Fulget ligados no painel. */
  function aplicarCenario(id, extra = {}) {
    const c = CEN.cenarios[id];
    const zonasCen = { ...c.zonas };
    const temGranito = Object.values(zonasCen).includes("granito");
    const temFulget = Object.values(zonasCen).includes("fulget");
    const granito = extra.granito ?? temGranito;
    const fulget = extra.fulget ?? temFulget;
    Object.keys(zonasCen).forEach((z) => {
      let v = zonasCen[z];
      if (granito) v = "granito";
      else if (v === "granito") v = "branco_neve";       // granito desligado → pintura
      if (!granito && (z === "faixa_sup" || z === "faixa_inf")) {
        if (fulget) v = "fulget";
        else if (v === "fulget") v = "cromio";
      }
      pintar(mat.zona[z], v);
    });
    pintar(mat.zona.terreo, c.terreo);
    mat.esquadria.color.set(corDe(c.esquadria));
    mat.acm.color.set(corDe(c.carenagens || "acm_jade_silver"));
  }

  raiz.userData.grupos = {
    Corpo: gCorpo, Janelas: gJanelas, Cobogos: gCobogos, Carenagens: gCarenagens,
    Brises: gBrises, Torres: gTorres, Pilotis: gPilotis, Terreno: gTerreno,
  };
  raiz.userData.aplicarCenario = aplicarCenario;
  raiz.userData.dimensoes = { L, D, ZT, alturaTotal: T.z_topo };
  return raiz;
}

if (typeof module !== "undefined") module.exports = { criarModelo };
