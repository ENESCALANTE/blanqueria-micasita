import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { 
  ShoppingBag, Search, ShoppingCart, X, Plus, Minus, ExternalLink, 
  MessageCircle, ArrowLeft, Lock, Edit3, Trash2, Tag, Check, Image as ImageIcon, KeyRound, LogOut, Upload, Loader2, Settings, ChevronRight, ChevronLeft, ZoomIn
} from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = "okej62yk"; 
const CLOUDINARY_UPLOAD_PRESET = "preset_micasita";

// EMAIL AUTORIZADO PARA ESTA TIENDA
const EMAIL_AUTORIZADO = "gracielaorsetti@guiaclic.com.ar";

// Arma la galería de fotos de un producto combinando las fotos generales
// (imagenes[]) con la foto específica de cada variante (imagen_asociada_url),
// sin duplicar una misma URL dos veces. Cada foto queda etiquetada con la
// variante a la que pertenece (o null si es una foto general del producto),
// para poder sincronizar los selectores de medida/material/color al navegar.
function construirGaleria(prod) {
  if (!prod) return [];
  const fotosGenerales = (prod.imagenes && prod.imagenes.length > 0)
    ? prod.imagenes
    : (prod.imagen_url ? [prod.imagen_url] : []);
  const variantes = prod.variantes || [];

  const vistas = new Set();
  const galeria = [];

  fotosGenerales.forEach((url) => {
    if (url && !vistas.has(url)) {
      vistas.add(url);
      galeria.push({ url, variante: null });
    }
  });

  variantes.forEach((v) => {
    const url = v.imagen_asociada_url;
    if (url && !vistas.has(url)) {
      vistas.add(url);
      galeria.push({ url, variante: v });
    }
  });

  return galeria;
}

export default function App() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloOfertas, setSoloOfertas] = useState(false);

  // Modal Detalle de Producto estilo Tiendanube
  const [productoDetalle, setProductoDetalle] = useState(null);
  const [imagenActivaIndex, setImagenActivaIndex] = useState(0);
  const [imagenVarianteDirecta, setImagenVarianteDirecta] = useState(null);
  const [lightboxAbierto, setLightboxAbierto] = useState(false);
  const [imagenHoverZoom, setImagenHoverZoom] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [medidaSel, setMedidaSel] = useState('');
  const [materialSel, setMaterialSel] = useState('');
  const [colorSel, setColorSel] = useState('');
  const [cantidadSel, setCantidadSel] = useState(1);

  // Configuración Negocio (Logo, Nombre, Subtítulo)
  const [configNegocio, setConfigNegocio] = useState({
    id: null,
    nombre: 'MI CASITA',
    subtitulo: 'BLANQUERÍA & HOGAR',
    logo_url: ''
  });
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  // Carrito y Notificación Toast
  const [carrito, setCarrito] = useState([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [toastMensaje, setToastMensaje] = useState('');
  const [animarCarrito, setAnimarCarrito] = useState(false);

  // Modo Admin (Supabase Auth)
  const [esAdmin, setEsAdmin] = useState(false);
  const [modalAdminAbierto, setModalAdminAbierto] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorPassword, setErrorPassword] = useState('');
  const [cargandoAuth, setCargandoAuth] = useState(false);
  
  // Formulario Producto Admin
  const [productoEditar, setProductoEditar] = useState(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [subiendoImagenVarIdx, setSubiendoImagenVarIdx] = useState(null);
  const [formProd, setFormProd] = useState({
    titulo: '',
    categoria: '',
    descripcion: '',
    precio: '',
    precio_oferta: '',
    imagenes: []
  });

  // Estado para variantes en el form admin
  const [formVariantes, setFormVariantes] = useState([
    { medida: '', material: '', color: '', stock: 10, precio: '', precio_oferta: '', imagen_asociada_url: '' }
  ]);

  const WHATSAPP_NUMBER = "5493462693014";
  const GUIA_CLIC_URL = "https://guiaclic.com.ar/aviso/21";

  useEffect(() => {
    fetchProductos();
    fetchConfigNegocio();
    verificarSesion();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email === EMAIL_AUTORIZADO) {
        setEsAdmin(true);
      } else {
        if (session) await supabase.auth.signOut();
        setEsAdmin(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Navegación de la galería de fotos con las flechas del teclado (← →),
  // solo mientras el modal de detalle de producto está abierto.
  const touchStartXRef = useRef(null);

  useEffect(() => {
    if (!productoDetalle) return;

    const imgs = (productoDetalle.imagenes && productoDetalle.imagenes.length > 0)
      ? productoDetalle.imagenes
      : (productoDetalle.imagen_url ? [productoDetalle.imagen_url] : []);

    if (imgs.length <= 1) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        setImagenVarianteDirecta(null);
        setImagenActivaIndex((prev) => (prev + 1) % imgs.length);
      } else if (e.key === 'ArrowLeft') {
        setImagenVarianteDirecta(null);
        setImagenActivaIndex((prev) => (prev - 1 + imgs.length) % imgs.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productoDetalle]);

  const mostrarToast = (mensaje) => {
    setToastMensaje(mensaje);
    setAnimarCarrito(true);
    setTimeout(() => setAnimarCarrito(false), 600);
    setTimeout(() => setToastMensaje(''), 3000);
  };

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email === EMAIL_AUTORIZADO) {
      setEsAdmin(true);
    } else {
      if (session) await supabase.auth.signOut();
      setEsAdmin(false);
    }
  }

  async function fetchProductos() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blanqueria_micasita')
        .select(`
          *,
          variantes:blanqueria_micasita_variantes(*)
        `)
        .order('id', { ascending: false });

      if (error) throw error;
      setProductos(data || []);
    } catch (error) {
      console.error('Error cargando productos:', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConfigNegocio() {
    try {
      const { data } = await supabase
        .from('config_negocio')
        .select('*')
        .limit(1)
        .single();

      if (data) setConfigNegocio(data);
    } catch (error) {
      console.error('Error cargando datos del negocio:', error.message);
    }
  }

  const handleSubirImagen = async (e, esLogo = false, esVarianteIndex = null) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    try {
      if (esLogo) setSubiendoLogo(true);
      else if (esVarianteIndex !== null) setSubiendoImagenVarIdx(esVarianteIndex);
      else setSubiendoImagen(true);

      const urlsSubidas = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (data.secure_url) {
          urlsSubidas.push(data.secure_url);
        } else {
          throw new Error(data.error?.message || 'Error al subir la imagen');
        }
      }

      if (esLogo) {
        setConfigNegocio((prev) => ({ ...prev, logo_url: urlsSubidas[0] }));
      } else if (esVarianteIndex !== null) {
        setFormVariantes((prev) => {
          const copia = [...prev];
          copia[esVarianteIndex].imagen_asociada_url = urlsSubidas[0];
          return copia;
        });
      } else {
        setFormProd((prev) => ({
          ...prev,
          imagenes: [...prev.imagenes, ...urlsSubidas]
        }));
      }
    } catch (error) {
      alert('Error al subir la imagen: ' + error.message);
    } finally {
      if (esLogo) setSubiendoLogo(false);
      else if (esVarianteIndex !== null) setSubiendoImagenVarIdx(null);
      else setSubiendoImagen(false);
    }
  };

  const guardarConfigNegocio = async (e) => {
    e.preventDefault();
    try {
      if (configNegocio.id) {
        const { error } = await supabase
          .from('config_negocio')
          .update({
            nombre: configNegocio.nombre,
            subtitulo: configNegocio.subtitulo,
            logo_url: configNegocio.logo_url
          })
          .eq('id', configNegocio.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('config_negocio')
          .insert([{
            nombre: configNegocio.nombre,
            subtitulo: configNegocio.subtitulo,
            logo_url: configNegocio.logo_url
          }])
          .select()
          .single();
        if (error) throw error;
        if (data) setConfigNegocio(data);
      }
      alert('¡Datos del negocio guardados correctamente!');
    } catch (error) {
      alert('Error al guardar datos del negocio: ' + error.message);
    }
  };

  const handleLoginAdmin = async (e) => {
    e.preventDefault();
    setErrorPassword('');
    setCargandoAuth(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput,
      });

      if (error) throw error;

      if (data.user?.email !== EMAIL_AUTORIZADO) {
        await supabase.auth.signOut();
        setErrorPassword('Usuario incorrecto.');
        return;
      }

      setEsAdmin(true);
      setModalAdminAbierto(false);
      setEmailInput('');
      setPasswordInput('');
    } catch (error) {
      setErrorPassword('Email o contraseña incorrectos.');
    } finally {
      setCargandoAuth(false);
    }
  };

  const handleLogoutAdmin = async () => {
    await supabase.auth.signOut();
    setEsAdmin(false);
  };

  // Abrir Modal de Detalle de Producto
  const abrirDetalleProducto = (prod) => {
    setProductoDetalle(prod);
    setCantidadSel(1);
    setLightboxAbierto(false);

    const vars = prod.variantes || [];
    const galeria = construirGaleria(prod);

    if (vars.length > 0) {
      setMedidaSel(vars[0].medida || '');
      setMaterialSel(vars[0].material || '');
      setColorSel(vars[0].color || '');
      const idxInicial = vars[0].imagen_asociada_url
        ? galeria.findIndex((g) => g.url === vars[0].imagen_asociada_url)
        : -1;
      setImagenActivaIndex(idxInicial >= 0 ? idxInicial : 0);
    } else {
      setMedidaSel('');
      setMaterialSel('');
      setColorSel('');
      setImagenActivaIndex(0);
    }
  };

  // Calcular variante seleccionada actualmente en el modal
  // IMPORTANTE: si la combinación elegida no existe como variante real, devolvemos null
  // en vez de "adivinar" con la primera variante. Ese fallback silencioso era lo que hacía
  // que distintas selecciones terminaran compartiendo el mismo ID en el carrito.
  const obtenerVarianteSeleccionada = () => {
    if (!productoDetalle || !productoDetalle.variantes || productoDetalle.variantes.length === 0) return null;
    return productoDetalle.variantes.find((v) => 
      (medidaSel === '' || v.medida === medidaSel) &&
      (materialSel === '' || v.material === materialSel) &&
      (colorSel === '' || v.color === colorSel)
    ) || null;
  };

  const varianteActual = obtenerVarianteSeleccionada();

  // Actualizar imagen automáticamente al cambiar variantes.
  // Los 3 selectores (medida/material/color) NO son independientes: solo existen las
  // combinaciones que realmente están cargadas como filas en blanqueria_micasita_variantes.
  // Por eso, al tocar un selector, si la combinación resultante con los otros dos valores
  // ya elegidos no corresponde a ninguna variante real, reacomodamos esos otros dos para
  // que siempre queden apuntando a una variante que sí existe (nunca una inventada).
  const handleCambioVariante = (tipo, valor) => {
    const variantes = productoDetalle?.variantes || [];

    let m = medidaSel;
    let mat = materialSel;
    let c = colorSel;

    if (tipo === 'medida') m = valor;
    if (tipo === 'material') mat = valor;
    if (tipo === 'color') c = valor;

    // Variantes que cumplen con el valor que se acaba de elegir
    const candidatas = variantes.filter((v) => {
      if (tipo === 'medida') return v.medida === valor;
      if (tipo === 'material') return v.material === valor;
      return v.color === valor;
    });

    const combinacionValida = candidatas.some((v) =>
      (m === '' || v.medida === m) &&
      (mat === '' || v.material === mat) &&
      (c === '' || v.color === c)
    );

    // Si con el nuevo valor la combinación actual dejó de existir, saltamos a la
    // primera variante candidata completa (no solo el campo que cambió) para
    // garantizar que siempre quede seleccionada una variante real.
    if (!combinacionValida && candidatas[0]) {
      m = candidatas[0].medida || '';
      mat = candidatas[0].material || '';
      c = candidatas[0].color || '';
    }

    setMedidaSel(m);
    setMaterialSel(mat);
    setColorSel(c);

    const encontrada = variantes.find((v) =>
      (m === '' || v.medida === m) &&
      (mat === '' || v.material === mat) &&
      (c === '' || v.color === c)
    ) || candidatas[0] || null;

    setImagenVarianteDirecta(encontrada?.imagen_asociada_url || null);
  };

  // Calcular precio actual según la variante o producto base
  const tieneVariantes = (productoDetalle?.variantes || []).length > 0;

  const obtenerPrecioActual = () => {
    if (varianteActual) {
      const pOferta = varianteActual.precio_oferta ? Number(varianteActual.precio_oferta) : null;
      const pNormal = varianteActual.precio ? Number(varianteActual.precio) : Number(productoDetalle?.precio || 0);
      return {
        precio: pOferta || pNormal,
        precioOriginal: pOferta ? pNormal : null,
        stock: varianteActual.stock ?? 0
      };
    }
    // El producto tiene variantes pero la combinación elegida no existe: no inventamos
    // precio ni stock de otra variante, bloqueamos la compra hasta que elija una combinación válida.
    if (tieneVariantes) {
      const pOferta = productoDetalle?.precio_oferta ? Number(productoDetalle.precio_oferta) : null;
      const pNormal = Number(productoDetalle?.precio || 0);
      return {
        precio: pOferta || pNormal,
        precioOriginal: pOferta ? pNormal : null,
        stock: 0
      };
    }
    const pOferta = productoDetalle?.precio_oferta ? Number(productoDetalle.precio_oferta) : null;
    const pNormal = Number(productoDetalle?.precio || 0);
    return {
      precio: pOferta || pNormal,
      precioOriginal: pOferta ? pNormal : null,
      stock: 999
    };
  };

  const agregarAlCarritoDesdeDetalle = () => {
    if (!productoDetalle) return;

    // Si el producto tiene variantes pero la combinación elegida no corresponde a
    // ninguna variante real, no dejamos agregar (antes esto se "resolvía" agregando
    // silenciosamente la primera variante, que es lo que mezclaba todo en el carrito).
    if (tieneVariantes && !varianteActual) {
      alert('Esa combinación no está disponible. Elegí otra opción.');
      return;
    }

    const infoPrecio = obtenerPrecioActual();

    const imgFinal = imagenVarianteDirecta || 
      (productoDetalle.imagenes && productoDetalle.imagenes[0]) || 
      productoDetalle.imagen_url || '';

    // Generación de ID único: siempre el ID real de la variante encontrada (o "base" si el
    // producto no tiene variantes). Ya no depende de un fallback adivinado.
    const varianteKey = varianteActual ? varianteActual.id : 'base';

    const itemCarrito = {
      id: `${productoDetalle.id}_${varianteKey}`,
      producto_id: productoDetalle.id,
      variante_id: varianteActual?.id || null,
      titulo: productoDetalle.titulo,
      medida: medidaSel,
      material: materialSel,
      color: colorSel,
      precioEfectivo: infoPrecio.precio,
      cantidad: cantidadSel,
      imagen: imgFinal
    };

    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === itemCarrito.id);
      if (existe) {
        return prev.map((item) =>
          item.id === itemCarrito.id ? { ...item, cantidad: item.cantidad + cantidadSel } : item
        );
      }
      return [...prev, itemCarrito];
    });

    setProductoDetalle(null);
    mostrarToast(`¡"${productoDetalle.titulo}" agregado al carrito!`);
  };

  const modificarCantidad = (id, delta) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nuevaCant = item.cantidad + delta;
            return nuevaCant > 0 ? { ...item, cantidad: nuevaCant } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const vaciarCarrito = () => {
    if (carrito.length === 0) return;
    if (!confirm('¿Vaciar todo el carrito?')) return;
    setCarrito([]);
  };

  const totalCarrito = carrito.reduce((sum, item) => sum + item.precioEfectivo * item.cantidad, 0);
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

  const enviarPedidoWhatsApp = () => {
    if (carrito.length === 0) return;
    let mensaje = `Hola! Quisiera realizar el siguiente pedido en *${configNegocio.nombre}*:\n\n`;
    carrito.forEach((item) => {
      let detalles = [];
      if (item.medida) detalles.push(`Medida: ${item.medida}`);
      if (item.material) detalles.push(`Material: ${item.material}`);
      if (item.color) detalles.push(`Color: ${item.color}`);
      
      const strDetalles = detalles.length > 0 ? ` (${detalles.join(', ')})` : '';
      mensaje += `• *${item.titulo}*${strDetalles} x${item.cantidad} - $${item.precioEfectivo * item.cantidad}\n`;
    });
    mensaje += `\n*TOTAL ESTIMADO: $${totalCarrito}*`;

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const normalizarCategoria = (valorIngresado) => {
    const limpio = (valorIngresado || '').trim();
    if (!limpio) return '';
    const existente = categorias.find((c) => c.toLowerCase() === limpio.toLowerCase());
    if (existente) return existente;
    return limpio.charAt(0).toUpperCase() + limpio.slice(1);
  };

  // ADMIN: Guardar Producto y sus Variantes
  const guardarProducto = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        titulo: formProd.titulo,
        categoria: normalizarCategoria(formProd.categoria),
        descripcion: formProd.descripcion,
        precio: Number(formProd.precio) || 0,
        precio_oferta: formProd.precio_oferta ? Number(formProd.precio_oferta) : null,
        imagenes: formProd.imagenes,
        imagen_url: formProd.imagenes[0] || ''
      };

      let prodId = productoEditar?.id;

      if (productoEditar) {
        const { error } = await supabase
          .from('blanqueria_micasita')
          .update(payload)
          .eq('id', prodId);
        if (error) throw error;

        // Borrar variantes viejas para reinsertar las actualizadas
        await supabase.from('blanqueria_micasita_variantes').delete().eq('producto_id', prodId);
      } else {
        const { data, error } = await supabase
          .from('blanqueria_micasita')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        prodId = data.id;
      }

      // Insertar Variantes con su foto correspondiente
      if (formVariantes.length > 0 && prodId) {
        const variantesPayload = formVariantes.map((v) => ({
          producto_id: prodId,
          medida: v.medida,
          material: v.material,
          color: v.color,
          stock: Number(v.stock) || 0,
          precio: v.precio ? Number(v.precio) : null,
          precio_oferta: v.precio_oferta ? Number(v.precio_oferta) : null,
          imagen_asociada_url: v.imagen_asociada_url || null
        }));

        const { error: errVar } = await supabase
          .from('blanqueria_micasita_variantes')
          .insert(variantesPayload);
        if (errVar) throw errVar;
      }

      setFormProd({ titulo: '', categoria: '', descripcion: '', precio: '', precio_oferta: '', imagenes: [] });
      setFormVariantes([{ medida: '', material: '', color: '', stock: 10, precio: '', precio_oferta: '', imagen_asociada_url: '' }]);
      setProductoEditar(null);
      fetchProductos();
      alert('¡Producto y variantes guardados correctamente!');
    } catch (err) {
      alert('Error al guardar el producto: ' + err.message);
    }
  };

  const editarProducto = (prod) => {
    setProductoEditar(prod);
    const imgs = prod.imagenes && prod.imagenes.length > 0 ? prod.imagenes : (prod.imagen_url ? [prod.imagen_url] : []);
    setFormProd({
      titulo: prod.titulo || '',
      categoria: prod.categoria || '',
      descripcion: prod.descripcion || '',
      precio: prod.precio || '',
      precio_oferta: prod.precio_oferta || '',
      imagenes: imgs
    });

    if (prod.variantes && prod.variantes.length > 0) {
      setFormVariantes(prod.variantes.map((v) => ({
        medida: v.medida || '',
        material: v.material || '',
        color: v.color || '',
        stock: v.stock ?? 10,
        precio: v.precio || '',
        precio_oferta: v.precio_oferta || '',
        imagen_asociada_url: v.imagen_asociada_url || ''
      })));
    } else {
      setFormVariantes([{ medida: '', material: '', color: '', stock: 10, precio: '', precio_oferta: '', imagen_asociada_url: '' }]);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarProducto = async (id) => {
    if (!confirm('¿Seguro que querés eliminar este producto?')) return;
    try {
      const { error } = await supabase.from('blanqueria_micasita').delete().eq('id', id);
      if (error) throw error;
      fetchProductos();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const categorias = [...new Map(
    productos
      .map((p) => (p?.categoria || '').trim())
      .filter(Boolean)
      .map((cat) => [cat.toLowerCase(), cat])
  ).values()];

  const obtenerImagenCategoria = (cat) => {
    const prod = productos.find(
      (p) => (p.categoria || '').trim().toLowerCase() === cat.trim().toLowerCase() && 
      ((p.imagenes && p.imagenes[0]) || p.imagen_url)
    );
    return (prod?.imagenes && prod?.imagenes[0]) || prod?.imagen_url || 'https://res.cloudinary.com/okej62yk/image/upload/v1787538636/spacejoy-nEtpvJjnPVo-unsplash.jpg';
  };

  const productosFiltrados = productos.filter((p) => {
    const titulo = (p?.titulo || '').toLowerCase();
    const query = busqueda.toLowerCase();
    const coincideCategoria =
      !categoriaSeleccionada ||
      (p?.categoria || '').trim().toLowerCase() === categoriaSeleccionada.trim().toLowerCase();
    const coincideBusqueda = titulo.includes(query);
    const coincideOferta = !soloOfertas || (p?.precio_oferta && Number(p.precio_oferta) > 0);
    return coincideCategoria && coincideBusqueda && coincideOferta;
  });

  // Valores de medida/material/color ya cargados en CUALQUIER producto del catálogo.
  // Se usan como sugerencias (datalist) al cargar variantes en el panel admin, para que
  // el comerciante elija lo ya existente en vez de escribirlo de nuevo y arriesgarse a
  // tipeos distintos para lo mismo (ej. "Algodon" vs "Algodón").
  const medidasExistentes = [...new Set(
    productos.flatMap((p) => (p.variantes || []).map((v) => (v.medida || '').trim())).filter(Boolean)
  )].sort();
  const materialesExistentes = [...new Set(
    productos.flatMap((p) => (p.variantes || []).map((v) => (v.material || '').trim())).filter(Boolean)
  )].sort();
  const coloresExistentes = [...new Set(
    productos.flatMap((p) => (p.variantes || []).map((v) => (v.color || '').trim())).filter(Boolean)
  )].sort();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-between font-sans antialiased">
      <div>
        {/* Banner Superior */}
        <div className="bg-emerald-950 text-emerald-100 text-xs sm:text-sm py-2 px-4 font-semibold text-center flex justify-center items-center gap-2">
          <span>✨ ¡Atención directa por WhatsApp y envíos a domicilio!</span>
          <a href={GUIA_CLIC_URL} target="_blank" rel="noreferrer" className="underline font-bold flex items-center gap-1 hover:text-white">
            Ver en GuíaClic <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* HEADER */}
        <header className="bg-emerald-900 text-white sticky top-0 z-30 shadow-md">
          <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
            
            {/* LOGO + NOMBRE + SUBTÍTULO */}
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => { setCategoriaSeleccionada(null); setBusqueda(''); setSoloOfertas(false); }}
            >
              {configNegocio.logo_url ? (
                <img 
                  src={configNegocio.logo_url} 
                  alt={configNegocio.nombre} 
                  className="w-11 h-11 rounded-full object-cover shadow border border-white/20"
                />
              ) : (
                <div className="bg-white text-emerald-900 font-extrabold rounded-full w-11 h-11 flex items-center justify-center text-2xl shadow">
                  {configNegocio.nombre.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-extrabold uppercase tracking-tight leading-none">{configNegocio.nombre}</h1>
                <span className="text-xs text-emerald-200 tracking-widest uppercase font-semibold">{configNegocio.subtitulo}</span>
              </div>
            </div>

            <div className="flex-1 max-w-md hidden md:block">
              <div className="relative">
                <input
                  type="text"
                  placeholder="¿Qué estás buscando?"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 rounded-full text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-inner"
                />
                <Search className="absolute right-3.5 top-3 w-5 h-5 text-slate-400" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCarritoAbierto(true)}
                className={`relative p-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-full transition-all duration-300 flex items-center gap-2 px-4 shadow ${
                  animarCarrito ? 'scale-110 bg-emerald-600 ring-4 ring-emerald-300' : ''
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="text-xs font-bold hidden sm:inline uppercase tracking-wider">Carrito</span>
                {totalItems > 0 && (
                  <span className={`bg-rose-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-300 ${
                    animarCarrito ? 'scale-150' : 'scale-100'
                  }`}>
                    {totalItems}
                  </span>
                )}
              </button>

              <button
                onClick={() => esAdmin ? handleLogoutAdmin() : setModalAdminAbierto(true)}
                className={`p-2.5 rounded-full transition-colors ${esAdmin ? 'bg-amber-400 text-slate-900' : 'hover:bg-emerald-800 text-emerald-100'}`}
                title={esAdmin ? 'Cerrar Sesión Admin' : 'Ingresar como Admin'}
              >
                {esAdmin ? <LogOut className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <nav className="bg-emerald-950/60 border-t border-emerald-800 text-xs sm:text-sm font-bold uppercase tracking-wider overflow-x-auto">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-8 whitespace-nowrap">
              <button 
                onClick={() => { setCategoriaSeleccionada(null); setSoloOfertas(false); setBusqueda(''); }}
                className={`hover:text-emerald-200 transition-colors ${!categoriaSeleccionada && !soloOfertas ? 'text-amber-300 font-extrabold border-b-2 border-amber-300 pb-0.5' : 'text-white'}`}
              >
                Inicio
              </button>
              <button 
                onClick={() => { setSoloOfertas(true); setCategoriaSeleccionada(null); }}
                className={`flex items-center gap-1.5 text-rose-300 hover:text-rose-200 transition-colors ${soloOfertas ? 'font-extrabold border-b-2 border-rose-400 pb-0.5' : ''}`}
              >
                <Tag className="w-4 h-4 fill-current" /> Ofertas Especiales
              </button>
              {categorias.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategoriaSeleccionada(cat); setSoloOfertas(false); }}
                  className={`capitalize hover:text-emerald-200 transition-colors ${categoriaSeleccionada === cat ? 'text-amber-300 font-extrabold border-b-2 border-amber-300 pb-0.5' : 'text-white'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </nav>
        </header>

        {/* Buscador Mobile */}
        <div className="md:hidden p-3 bg-white border-b border-slate-200">
          <div className="relative">
            <input
              type="text"
              placeholder="¿Qué estás buscando?"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 text-sm font-medium focus:outline-none focus:bg-white border border-slate-200"
            />
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* PANEL ADMIN COMPLETO */}
        {esAdmin && (
          <section className="bg-amber-50 border-2 border-amber-300 p-5 max-w-6xl mx-auto my-6 rounded-2xl shadow-lg space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-amber-200">
              <div className="flex items-center gap-2 text-amber-950 font-extrabold text-base sm:text-lg uppercase tracking-wide">
                <KeyRound className="w-6 h-6 text-amber-600" /> Panel de Administración
              </div>
              <button 
                onClick={handleLogoutAdmin} 
                className="text-xs font-bold bg-amber-200 hover:bg-amber-300 px-3.5 py-1.5 rounded-lg text-amber-900 flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión Admin
              </button>
            </div>

            {/* EDICIÓN DE MARCA Y LOGO */}
            <form onSubmit={guardarConfigNegocio} className="bg-white p-5 rounded-xl border border-amber-200 space-y-4 shadow-sm">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-amber-600" /> Configuración de la Marca (Logo y Títulos)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nombre del Negocio</label>
                  <input
                    type="text"
                    required
                    placeholder="MI CASITA"
                    value={configNegocio.nombre}
                    onChange={(e) => setConfigNegocio({ ...configNegocio, nombre: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Subtítulo / Rubro</label>
                  <input
                    type="text"
                    required
                    placeholder="BLANQUERÍA & HOGAR"
                    value={configNegocio.subtitulo}
                    onChange={(e) => setConfigNegocio({ ...configNegocio, subtitulo: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Logo del Negocio</label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 shadow transition-colors">
                      {subiendoLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {subiendoLogo ? 'Subiendo...' : '📷 Cambiar Logo'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleSubirImagen(e, true)} 
                        disabled={subiendoLogo} 
                        className="hidden" 
                      />
                    </label>

                    {configNegocio.logo_url && (
                      <img src={configNegocio.logo_url} alt="Logo previo" className="w-9 h-9 object-cover rounded-full border border-slate-300 shadow-sm" />
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={subiendoLogo}
                className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Actualizar Marca
              </button>
            </form>

            {/* SECCIÓN CARGA DE PRODUCTOS Y VARIANTES */}
            <form onSubmit={guardarProducto} className="bg-white p-5 rounded-xl border border-amber-200 space-y-6 shadow-sm">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                {productoEditar ? '✏️ Modificar Producto' : '➕ CARGAR NUEVO PRODUCTO'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Título / Nombre</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juego de Sábanas 2 1/2 Plazas"
                    value={formProd.titulo}
                    onChange={(e) => setFormProd({ ...formProd, titulo: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Rubro / Categoría</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Sábanas, Manteles, Cortinas..."
                    value={formProd.categoria}
                    onChange={(e) => setFormProd({ ...formProd, categoria: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Precio Base ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="12000"
                    value={formProd.precio}
                    onChange={(e) => setFormProd({ ...formProd, precio: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-rose-700 block mb-1">Precio Oferta Base ($ - Opcional)</label>
                  <input
                    type="number"
                    placeholder="Dejar vacío si no hay oferta"
                    value={formProd.precio_oferta}
                    onChange={(e) => setFormProd({ ...formProd, precio_oferta: e.target.value })}
                    className="w-full p-2.5 border border-rose-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-rose-500 bg-rose-50/40"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Imágenes General del Producto (Múltiples fotos)</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="cursor-pointer bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 shadow transition-colors">
                      {subiendoImagen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {subiendoImagen ? 'Subiendo fotos...' : '📷 Agregar Fotos General'}
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={(e) => handleSubirImagen(e, false)} 
                        disabled={subiendoImagen} 
                        className="hidden" 
                      />
                    </label>

                    {formProd.imagenes.map((url, idx) => (
                      <div key={idx} className="relative group w-10 h-10 border rounded-lg overflow-hidden">
                        <img src={url} alt="Cargada" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormProd(prev => ({ ...prev, imagenes: prev.imagenes.filter((_, i) => i !== idx) }))}
                          className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Descripción Detallada</label>
                  <textarea
                    rows={2}
                    placeholder="Escribí características del producto, calidad de la tela, etc."
                    value={formProd.descripcion}
                    onChange={(e) => setFormProd({ ...formProd, descripcion: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* GESTIÓN DE VARIANTES CON FOTO ESPECÍFICA */}
              <div className="border-t border-amber-200 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Variantes de Producto (Medida / Material / Color / Stock / Precio / Foto)
                  </h5>
                  <button
                    type="button"
                    onClick={() => setFormVariantes(prev => [...prev, { medida: '', material: '', color: '', stock: 10, precio: '', precio_oferta: '', imagen_asociada_url: '' }])}
                    className="text-xs font-bold bg-emerald-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-800"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Variante
                  </button>
                </div>

                {/* Sugerencias de valores ya usados: el input sigue siendo libre (se puede
                    escribir uno nuevo), pero el navegador ofrece autocompletar con lo ya
                    cargado en el catálogo, para evitar variantes duplicadas por tipeo
                    (ej. "Algodon" vs "Algodón"). */}
                <datalist id="datalist-medidas">
                  {medidasExistentes.map((m) => <option key={m} value={m} />)}
                </datalist>
                <datalist id="datalist-materiales">
                  {materialesExistentes.map((m) => <option key={m} value={m} />)}
                </datalist>
                <datalist id="datalist-colores">
                  {coloresExistentes.map((c) => <option key={c} value={c} />)}
                </datalist>

                {formVariantes.map((v, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-7 gap-3 items-center">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Medida/Talle</label>
                      <input
                        type="text"
                        list="datalist-medidas"
                        placeholder="2 1/2"
                        value={v.medida}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, medida: val } : item));
                        }}
                        className="w-full p-2 border rounded-lg text-xs font-medium bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Material</label>
                      <input
                        type="text"
                        list="datalist-materiales"
                        placeholder="Algodon"
                        value={v.material}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, material: val } : item));
                        }}
                        className="w-full p-2 border rounded-lg text-xs font-medium bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Color</label>
                      <input
                        type="text"
                        list="datalist-colores"
                        placeholder="Blanco"
                        value={v.color}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, color: val } : item));
                        }}
                        className="w-full p-2 border rounded-lg text-xs font-medium bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Stock</label>
                      <input
                        type="number"
                        placeholder="10"
                        value={v.stock}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, stock: val } : item));
                        }}
                        className="w-full p-2 border rounded-lg text-xs font-medium bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Precio Variante</label>
                      <input
                        type="number"
                        placeholder="Si difiere"
                        value={v.precio}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, precio: val } : item));
                        }}
                        className="w-full p-2 border rounded-lg text-xs font-medium bg-white"
                      />
                    </div>

                    {/* COLUMNA EXPLICITA PARA LA FOTO DE VARIANTE */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Foto Variante</label>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 w-full shadow-sm transition-colors">
                          {subiendoImagenVarIdx === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          <span>{v.imagen_asociada_url ? 'Cambiar' : 'Subir'}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleSubirImagen(e, false, idx)} 
                            disabled={subiendoImagenVarIdx === idx} 
                            className="hidden" 
                          />
                        </label>

                        {v.imagen_asociada_url && (
                          <div className="relative group w-8 h-8 border border-slate-300 rounded-lg overflow-hidden flex-shrink-0">
                            <img src={v.imagen_asociada_url} alt="Variante" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, imagen_asociada_url: '' } : item))}
                              className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2 md:pt-4">
                      {formVariantes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormVariantes(prev => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Eliminar Variante"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-amber-200">
                <button
                  type="submit"
                  disabled={subiendoImagen || subiendoImagenVarIdx !== null}
                  className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> {productoEditar ? 'Guardar Cambios del Producto' : 'Publicar Producto'}
                </button>
              </div>
            </form>
          </section>
        )}
        
        {/* LISTADO DE PRODUCTOS */}
        <main className="max-w-6xl mx-auto px-4 py-8">
          {categoriaSeleccionada || busqueda || soloOfertas ? (
            <div>
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
                <button
                  onClick={() => { setCategoriaSeleccionada(null); setBusqueda(''); setSoloOfertas(false); }}
                  className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 hover:underline uppercase tracking-wider"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver a la portada
                </button>
                <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight">
                  {soloOfertas ? '🔥 Ofertas Especiales' : categoriaSeleccionada || `Búsqueda: "${busqueda}"`}
                </h2>
              </div>

              {productosFiltrados.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm font-medium">
                  No encontramos productos para esta sección.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                  {productosFiltrados.map((prod) => {
                    const tieneOferta = prod.precio_oferta && Number(prod.precio_oferta) > 0;
                    const fotoPrincipal = (prod.imagenes && prod.imagenes[0]) || prod.imagen_url;

                    return (
                      <div 
                        key={prod.id} 
                        onClick={() => abrirDetalleProducto(prod)}
                        className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group cursor-pointer"
                      >
                        {tieneOferta && (
                          <div className="absolute top-3 left-3 z-10 bg-rose-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow">
                            OFERTA
                          </div>
                        )}

                        {esAdmin && (
                          <div 
                            className="absolute top-2 right-2 z-20 flex gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button onClick={() => editarProducto(prod)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => eliminarProducto(prod.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <div>
                          <div className="h-48 sm:h-56 w-full bg-slate-100 relative overflow-hidden">
                            {fotoPrincipal ? (
                              <img src={fotoPrincipal} alt={prod.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <ImageIcon className="w-8 h-8 mb-1" />
                                <span className="text-xs">Sin imagen</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="p-3.5">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{prod.categoria}</span>
                            <h3 className="font-bold text-sm text-slate-900 line-clamp-2 mt-0.5 leading-snug">{prod.titulo}</h3>
                            
                            <div className="mt-2.5 flex items-baseline gap-2">
                              {tieneOferta ? (
                                <>
                                  <span className="text-lg font-extrabold text-rose-600">${prod.precio_oferta}</span>
                                  <span className="text-xs text-slate-400 line-through font-semibold">${prod.precio}</span>
                                </>
                              ) : (
                                <span className="text-lg font-extrabold text-slate-900">${prod.precio}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="p-3.5 pt-0">
                          <button
                            className="w-full py-2.5 bg-slate-900 group-hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow"
                          >
                            Ver Producto
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* PORTADA TIENDA */
            <div className="space-y-12">
              <section className="relative rounded-3xl overflow-hidden shadow-2xl bg-slate-950 min-h-[340px] sm:min-h-[420px] flex items-center p-6 sm:p-12 text-white">
                <img
                  src={(productos[0]?.imagenes && productos[0]?.imagenes[0]) || productos[0]?.imagen_url || "https://res.cloudinary.com/okej62yk/image/upload/v1787538636/spacejoy-nEtpvJjnPVo-unsplash.jpg"}
                  alt="Colección Blanquería"
                  className="absolute inset-0 w-full h-full object-cover opacity-50"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/50 to-transparent" />

                <div className="relative z-10 max-w-xl space-y-4">
                  <span className="bg-amber-400 text-slate-950 text-xs font-extrabold uppercase tracking-widest px-3.5 py-1 rounded-full shadow">
                    Nueva Colección
                  </span>
                  <h2 className="text-3xl sm:text-5xl font-extrabold uppercase tracking-tight leading-none text-white drop-shadow">
                    Vestimos tu hogar de comodidad.
                  </h2>
                  <p className="text-slate-200 text-xs sm:text-sm font-medium leading-relaxed">
                    Aprovechá nuestras ofertas exclusivas en juegos de sábanas, manteles, cortinas y acolchados. Dormí rico, viví mejor.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setSoloOfertas(true)}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg transition-transform hover:scale-105"
                    >
                      Ver Ofertas Especiales
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <div className="text-center mb-8">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Secciones Destacadas</span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 uppercase tracking-tight mt-0.5">Nuestros Rubros</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {categorias.map((cat) => (
                    <div
                      key={cat}
                      onClick={() => setCategoriaSeleccionada(cat)}
                      className="group relative h-72 rounded-3xl overflow-hidden shadow-md cursor-pointer flex items-end p-6 border border-slate-200 transition-transform duration-300 hover:-translate-y-1.5"
                    >
                      <img
                        src={obtenerImagenCategoria(cat)}
                        alt={cat}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                      <div className="relative z-10 w-full bg-white/95 backdrop-blur-md p-4 rounded-2xl text-center shadow-lg border border-white/50">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">CATEGORÍA</span>
                        <h4 className="text-lg font-extrabold text-slate-900 uppercase tracking-wider mt-0.5">{cat}</h4>
                        <span className="inline-block mt-2 px-4 py-2 bg-emerald-800 group-hover:bg-rose-600 text-white text-xs font-extrabold rounded-xl uppercase tracking-wider transition-colors shadow">
                          VER PRODUCTOS
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* MODAL DETALLE DE PRODUCTO ESTILO TIENDANUBE */}
      {productoDetalle && (() => {
        const infoPrecio = obtenerPrecioActual();
        // Galería completa: fotos generales del producto + foto propia de cada
        // variante, sin duplicados. Así el cliente puede recorrer todas las
        // fotos (de cualquier medida/material/color) desde las miniaturas.
        const galeriaCompleta = construirGaleria(productoDetalle);
        const listaImagenes = galeriaCompleta.map((g) => g.url);

        const imagenAMostrar = imagenVarianteDirecta || listaImagenes[imagenActivaIndex] || listaImagenes[0];

        const irImagenSiguiente = () => {
          if (listaImagenes.length <= 1) return;
          setImagenVarianteDirecta(null);
          setImagenActivaIndex((prev) => (prev + 1) % listaImagenes.length);
        };
        const irImagenAnterior = () => {
          if (listaImagenes.length <= 1) return;
          setImagenVarianteDirecta(null);
          setImagenActivaIndex((prev) => (prev - 1 + listaImagenes.length) % listaImagenes.length);
        };

        // Al elegir una miniatura, si esa foto pertenece a una variante puntual,
        // sincronizamos los selectores de medida/material/color con esa variante
        // para que el cliente pueda ir directo a "Agregar al carrito".
        const seleccionarFoto = (idx) => {
          const item = galeriaCompleta[idx];
          setImagenActivaIndex(idx);
          setImagenVarianteDirecta(null);
          if (item?.variante) {
            setMedidaSel(item.variante.medida || '');
            setMaterialSel(item.variante.material || '');
            setColorSel(item.variante.color || '');
          }
        };

        // Zoom estilo MercadoLibre/Tiendanube: seguir el mouse para definir el
        // punto de la imagen que queda centrado al ampliarla.
        const manejarMouseMoveZoom = (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          setZoomPos({ x, y });
        };

        const cerrarDetalle = () => {
          setProductoDetalle(null);
          setLightboxAbierto(false);
          setImagenHoverZoom(false);
        };

        const variantes = productoDetalle.variantes || [];
        const medidasDisponibles = [...new Set(variantes.map(v => v.medida).filter(Boolean))];
        const materialesDisponibles = [...new Set(variantes.map(v => v.material).filter(Boolean))];
        const coloresDisponibles = [...new Set(variantes.map(v => v.color).filter(Boolean))];

        return (
          <>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-100 my-auto relative flex flex-col md:flex-row">
              <button 
                onClick={cerrarDetalle} 
                className="absolute top-4 right-4 z-20 bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* GALERÍA DE FOTOS */}
              <div className="w-full md:w-1/2 p-6 bg-slate-50 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-slate-200">
                <div
                  className="w-full h-80 sm:h-[28rem] rounded-2xl overflow-hidden bg-white shadow-inner relative flex items-center justify-center group touch-pan-y cursor-zoom-in"
                  onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    if (touchStartXRef.current === null) return;
                    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
                    touchStartXRef.current = null;
                    if (Math.abs(deltaX) < 40) return; // umbral mínimo para considerarlo swipe
                    if (deltaX < 0) irImagenSiguiente();
                    else irImagenAnterior();
                  }}
                  onMouseEnter={() => setImagenHoverZoom(true)}
                  onMouseLeave={() => setImagenHoverZoom(false)}
                  onMouseMove={manejarMouseMoveZoom}
                  onClick={() => imagenAMostrar && setLightboxAbierto(true)}
                >
                  {imagenAMostrar ? (
                    <img 
                      src={imagenAMostrar} 
                      alt={productoDetalle.titulo} 
                      className="w-full h-full object-contain select-none transition-transform duration-150 ease-out"
                      style={imagenHoverZoom ? { transform: 'scale(2)', transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : undefined}
                      draggable={false}
                    />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-slate-300" />
                  )}

                  {/* ÍCONO DE LUPA (indica que se puede ampliar) */}
                  {imagenAMostrar && (
                    <div className="absolute bottom-3 right-3 z-10 bg-white/90 text-slate-700 p-2 rounded-full shadow pointer-events-none">
                      <ZoomIn className="w-4 h-4" />
                    </div>
                  )}

                  {/* FLECHAS LATERALES DE NAVEGACIÓN (estilo Tiendanube/MercadoLibre) */}
                  {listaImagenes.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); irImagenAnterior(); }}
                        aria-label="Foto anterior"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-700 rounded-full p-2 shadow-md transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); irImagenSiguiente(); }}
                        aria-label="Foto siguiente"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-700 rounded-full p-2 shadow-md transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* MINIATURAS: fotos generales + foto de cada variante */}
                {listaImagenes.length > 1 && (
                  <div className="flex items-center gap-3 mt-4 overflow-x-auto max-w-full pb-2">
                    {galeriaCompleta.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => seleccionarFoto(idx)}
                        title={item.variante ? [item.variante.medida, item.variante.material, item.variante.color].filter(Boolean).join(' / ') : undefined}
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${(!imagenVarianteDirecta && imagenActivaIndex === idx) ? 'border-emerald-700 scale-105 shadow' : 'border-slate-200 opacity-60'}`}
                      >
                        <img src={item.url} alt="Miniatura" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* DETALLES Y OPCIONES DE VARIANTE */}
              <div className="w-full md:w-1/2 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-widest">{productoDetalle.categoria}</span>
                    <h2 className="text-2xl font-extrabold text-slate-900 leading-tight mt-1">{productoDetalle.titulo}</h2>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-slate-900">${infoPrecio.precio}</span>
                    {infoPrecio.precioOriginal && (
                      <span className="text-sm font-bold text-slate-400 line-through">${infoPrecio.precioOriginal}</span>
                    )}
                  </div>

                  {productoDetalle.descripcion && (
                    <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {productoDetalle.descripcion}
                    </p>
                  )}

                  {/* SELECTORES DE VARIANTES */}
                  <div className="space-y-3 pt-2">
                    {medidasDisponibles.length > 0 && (
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Medida / Talle:</label>
                        <select
                          value={medidaSel}
                          onChange={(e) => handleCambioVariante('medida', e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          {medidasDisponibles.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {materialesDisponibles.length > 0 && (
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Material:</label>
                        <select
                          value={materialSel}
                          onChange={(e) => handleCambioVariante('material', e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          {materialesDisponibles.map((mat) => (
                            <option key={mat} value={mat}>{mat}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {coloresDisponibles.length > 0 && (
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Color:</label>
                        <select
                          value={colorSel}
                          onChange={(e) => handleCambioVariante('color', e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          {coloresDisponibles.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* INDICADOR DE STOCK Y CANTIDAD */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider block text-slate-500">Stock disponible:</span>
                      <span className={`text-xs font-black ${infoPrecio.stock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {infoPrecio.stock > 0 ? `${infoPrecio.stock} unidades` : 'Sin stock'}
                      </span>
                    </div>

                    <div className="flex items-center border border-slate-300 rounded-xl bg-slate-50">
                      <button 
                        onClick={() => setCantidadSel(prev => Math.max(1, prev - 1))}
                        className="p-2 text-slate-600 hover:text-slate-900"
                        disabled={cantidadSel <= 1}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-extrabold">{cantidadSel}</span>
                      <button 
                        onClick={() => setCantidadSel(prev => Math.min(infoPrecio.stock, prev + 1))}
                        className="p-2 text-slate-600 hover:text-slate-900"
                        disabled={cantidadSel >= infoPrecio.stock}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {tieneVariantes && !varianteActual && (
                  <p className="text-[11px] font-bold text-rose-600 text-center -mt-2">
                    Esa combinación no está disponible. Probá con otra opción.
                  </p>
                )}

                {/* BOTÓN AGREGAR AL CARRITO */}
                <button
                  onClick={agregarAlCarritoDesdeDetalle}
                  disabled={infoPrecio.stock <= 0}
                  className="w-full py-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-4 h-4" /> 
                  {tieneVariantes && !varianteActual
                    ? 'Elegí una combinación'
                    : infoPrecio.stock > 0 ? 'Agregar al Carrito' : 'Sin Stock'}
                </button>
              </div>
            </div>
          </div>

          {/* LIGHTBOX: foto ampliada a pantalla completa, con zoom y navegación */}
          {lightboxAbierto && imagenAMostrar && (
            <div
              className="fixed inset-0 z-[60] bg-slate-950/95 flex items-center justify-center p-4"
              onClick={() => { setLightboxAbierto(false); setImagenHoverZoom(false); }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxAbierto(false); setImagenHoverZoom(false); }}
                aria-label="Cerrar"
                className="absolute top-4 right-4 z-20 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              {listaImagenes.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); irImagenAnterior(); }}
                    aria-label="Foto anterior"
                    className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); irImagenSiguiente(); }}
                    aria-label="Foto siguiente"
                    className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              <div
                className="relative w-full h-full max-w-5xl max-h-[85vh] overflow-hidden flex items-center justify-center cursor-zoom-in"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => setImagenHoverZoom(true)}
                onMouseLeave={() => setImagenHoverZoom(false)}
                onMouseMove={manejarMouseMoveZoom}
              >
                <img
                  src={imagenAMostrar}
                  alt={productoDetalle.titulo}
                  className="max-w-full max-h-full object-contain select-none transition-transform duration-150 ease-out"
                  style={imagenHoverZoom ? { transform: 'scale(2.2)', transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : undefined}
                  draggable={false}
                />
              </div>

              {listaImagenes.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs font-bold">
                  {imagenActivaIndex + 1} / {listaImagenes.length}
                </div>
              )}
            </div>
          )}
          </>
        );
      })()}

      {/* Botón WhatsApp */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-40 bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-110 flex items-center justify-center border-2 border-white"
        title="Consultar por WhatsApp"
      >
        <MessageCircle className="w-8 h-8 fill-current" />
      </a>

      {/* MODAL LOGIN ADMIN */}
      {modalAdminAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-800" /> Acceso Administración
              </h3>
              <button onClick={() => setModalAdminAbierto(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLoginAdmin} className="space-y-4">
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">Email:</label>
                <input
                  type="email"
                  required
                  placeholder="ej. gracielaorsetti@guiaclic.com.ar"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">Contraseña:</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {errorPassword && <p className="text-xs text-rose-600 font-bold">{errorPassword}</p>}

              <button
                type="submit"
                disabled={cargandoAuth}
                className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {cargandoAuth ? 'Verificando...' : 'Ingresar al Panel'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER CARRITO */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">Tu Carrito ({totalItems})</h2>
              <div className="flex items-center gap-1">
                {carrito.length > 0 && (
                  <button
                    onClick={vaciarCarrito}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg uppercase tracking-wide"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Vaciar
                  </button>
                )}
                <button onClick={() => setCarritoAbierto(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {carrito.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">El carrito está vacío.</div>
              ) : (
                carrito.map((item) => (
                  <div key={item.id} className="flex gap-3 items-center border-b border-slate-100 pb-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                      {item.imagen ? (
                        <img src={item.imagen} alt={item.titulo} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400">Sin foto</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-slate-900 truncate">{item.titulo}</h4>
                      {(item.medida || item.material || item.color) && (
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          {[item.medida, item.material, item.color].filter(Boolean).join(' / ')}
                        </p>
                      )}
                      <p className="text-xs font-extrabold text-emerald-800">${item.precioEfectivo}</p>
                    </div>
                    <div className="flex items-center border border-slate-200 rounded-lg">
                      <button onClick={() => modificarCantidad(item.id, -1)} className="p-1 text-slate-600">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-bold">{item.cantidad}</span>
                      <button onClick={() => modificarCantidad(item.id, 1)} className="p-1 text-slate-600">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {carrito.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
                <div className="flex justify-between items-center text-sm font-extrabold text-slate-900">
                  <span>Total Estimado:</span>
                  <span className="text-lg text-emerald-800">${totalCarrito}</span>
                </div>
                <button
                  onClick={enviarPedidoWhatsApp}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                  <MessageCircle className="w-4 h-4" /> Enviar Pedido por WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NOTIFICACIÓN TOAST FLOTANTE */}
      {toastMensaje && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-slate-700 flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMensaje}</span>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-emerald-950 text-emerald-300 border-t border-emerald-900 py-8 text-center text-xs mt-12">
        <p className="font-extrabold text-white mb-1 uppercase">{configNegocio.nombre}</p>
        <p className="text-emerald-400/80 mb-2 font-medium">Encontranos también en la guía local</p>
        <a href={GUIA_CLIC_URL} target="_blank" rel="noreferrer" className="text-amber-300 font-bold hover:underline">
          Publicación en GuíaClic
        </a>
      </footer>
    </div>
  );
}