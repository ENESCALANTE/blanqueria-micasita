import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  ShoppingBag, Search, ShoppingCart, X, Plus, Minus, ExternalLink, 
  MessageCircle, ArrowLeft, Lock, Edit3, Trash2, Tag, Check, Image as ImageIcon, KeyRound, LogOut, Upload, Loader2, Settings
} from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = "okej62yk"; 
const CLOUDINARY_UPLOAD_PRESET = "preset_micasita";

// EMAIL AUTORIZADO PARA ESTA TIENDA
const EMAIL_AUTORIZADO = "gracielaorsetti@guiaclic.com.ar";

export default function App() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloOfertas, setSoloOfertas] = useState(false);

  // Configuración Negocio (Logo, Nombre, Subtítulo)
  const [configNegocio, setConfigNegocio] = useState({
    id: null,
    nombre: 'MI CASITA',
    subtitulo: 'BLANQUERÍA & HOGAR',
    logo_url: ''
  });
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  // Carrito
  const [carrito, setCarrito] = useState([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);

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
  const [formProd, setFormProd] = useState({
    titulo: '',
    categoria: '',
    precio: '',
    precio_oferta: '',
    imagen_url: ''
  });

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
        .select('*')
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
      const { data, error } = await supabase
        .from('config_negocio')
        .select('*')
        .limit(1)
        .single();

      if (data) {
        setConfigNegocio(data);
      }
    } catch (error) {
      console.error('Error cargando datos del negocio:', error.message);
    }
  }

  const handleSubirImagen = async (e, esLogo = false) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      if (esLogo) setSubiendoLogo(true);
      else setSubiendoImagen(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.secure_url) {
        if (esLogo) {
          setConfigNegocio((prev) => ({ ...prev, logo_url: data.secure_url }));
        } else {
          setFormProd((prev) => ({ ...prev, imagen_url: data.secure_url }));
        }
      } else {
        throw new Error(data.error?.message || 'Error al subir la imagen');
      }
    } catch (error) {
      alert('Error al subir la imagen: ' + error.message);
    } finally {
      if (esLogo) setSubiendoLogo(false);
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

      // VALIDACIÓN DE SEGURIDAD
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

  const agregarAlCarrito = (producto) => {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === producto.id);
      const precioFinal = producto.precio_oferta ? Number(producto.precio_oferta) : Number(producto.precio);
      if (existe) {
        return prev.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prev, { ...producto, precioEfectivo: precioFinal, cantidad: 1 }];
    });
    setCarritoAbierto(true);
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
      mensaje += `• *${item.titulo}* x${item.cantidad} - $${item.precioEfectivo * item.cantidad}\n`;
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

  const guardarProducto = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        titulo: formProd.titulo,
        categoria: normalizarCategoria(formProd.categoria),
        precio: Number(formProd.precio) || 0,
        precio_oferta: formProd.precio_oferta ? Number(formProd.precio_oferta) : null,
        imagen_url: formProd.imagen_url
      };

      if (productoEditar) {
        const { error } = await supabase
          .from('blanqueria_micasita')
          .update(payload)
          .eq('id', productoEditar.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('blanqueria_micasita')
          .insert([payload]);
        if (error) throw error;
      }

      setFormProd({ titulo: '', categoria: '', precio: '', precio_oferta: '', imagen_url: '' });
      setProductoEditar(null);
      fetchProductos();
      alert('¡Producto guardado correctamente!');
    } catch (err) {
      alert('Error al guardar el producto: ' + err.message);
    }
  };

  const editarProducto = (prod) => {
    setProductoEditar(prod);
    setFormProd({
      titulo: prod.titulo || '',
      categoria: prod.categoria || '',
      precio: prod.precio || '',
      precio_oferta: prod.precio_oferta || '',
      imagen_url: prod.imagen_url || ''
    });
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
      (p) => (p.categoria || '').trim().toLowerCase() === cat.trim().toLowerCase() && p.imagen_url
    );
    return prod?.imagen_url || 'https://res.cloudinary.com/okej62yk/image/upload/v1787538636/spacejoy-nEtpvJjnPVo-unsplash.jpg';
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
                className="relative p-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-full transition-colors flex items-center gap-2 px-4 shadow"
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="text-xs font-bold hidden sm:inline uppercase tracking-wider">Carrito</span>
                {totalItems > 0 && (
                  <span className="bg-rose-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
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

            {/* SECCIÓN CARGA DE PRODUCTOS */}
            <form onSubmit={guardarProducto} className="bg-white p-5 rounded-xl border border-amber-200 space-y-4 shadow-sm">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                {productoEditar ? '✏️ Modificar Producto' : '➕ CARGAR NUEVO PRODUCTO'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Título / Nombre</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juego de Sábanas 2 Plazas"
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
                  <label className="text-xs font-bold text-slate-700 block mb-1">Precio Normal ($)</label>
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
                  <label className="text-xs font-bold text-rose-700 block mb-1">Precio Oferta ($ - Opcional)</label>
                  <input
                    type="number"
                    placeholder="Dejar vacío si no hay oferta"
                    value={formProd.precio_oferta}
                    onChange={(e) => setFormProd({ ...formProd, precio_oferta: e.target.value })}
                    className="w-full p-2.5 border border-rose-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-rose-500 bg-rose-50/40"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Imagen del Producto</label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 shadow transition-colors">
                      {subiendoImagen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {subiendoImagen ? 'Subiendo foto...' : '📷 Sacar o elegir foto'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleSubirImagen(e, false)} 
                        disabled={subiendoImagen} 
                        className="hidden" 
                      />
                    </label>

                    {formProd.imagen_url && (
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 p-1.5 rounded-lg">
                        <img src={formProd.imagen_url} alt="Vista previa" className="w-8 h-8 object-cover rounded" />
                        <span className="text-[11px] text-emerald-800 font-bold">¡Foto lista para guardar!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={subiendoImagen}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> {productoEditar ? 'Guardar Cambios' : 'Publicar Producto'}
                </button>
                {productoEditar && (
                  <button
                    type="button"
                    onClick={() => { setProductoEditar(null); setFormProd({ titulo: '', categoria: '', precio: '', precio_oferta: '', imagen_url: '' }); }}
                    className="bg-slate-200 text-slate-800 font-bold text-xs uppercase px-4 py-2.5 rounded-xl"
                  >
                    Cancelar
                  </button>
                )}
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
                    return (
                      <div key={prod.id} className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between relative group">
                        {tieneOferta && (
                          <div className="absolute top-3 left-3 z-10 bg-rose-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow">
                            OFERTA
                          </div>
                        )}

                        {esAdmin && (
                          <div className="absolute top-2 right-2 z-10 flex gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow">
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
                            {prod.imagen_url ? (
                              <img src={prod.imagen_url} alt={prod.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
                            onClick={() => agregarAlCarrito(prod)}
                            className="w-full py-2.5 bg-slate-900 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow"
                          >
                            <ShoppingCart className="w-4 h-4" /> Agregar
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
                  src={productos[0]?.imagen_url || "https://res.cloudinary.com/okej62yk/image/upload/v1787538636/spacejoy-nEtpvJjnPVo-unsplash.jpg"}
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
                      {item.imagen_url ? (
                        <img src={item.imagen_url} alt={item.titulo} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400">Sin foto</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-slate-900 truncate">{item.titulo}</h4>
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