/* Controlador de cada pantalla propia, según <html data-pantalla="…"> */
import { pantallaBiometria } from './biometria.js';
import { pantallaDesbloqueo } from './desbloqueo.js';
import { pantallaInicioSesion } from './inicio-sesion.js';
import { pantallaMiCuenta } from './mi-cuenta.js';

export const CONTROLADORES = {
  'inicio-sesion': pantallaInicioSesion,
  biometria: pantallaBiometria,
  desbloqueo: pantallaDesbloqueo,
  'mi-cuenta': pantallaMiCuenta
};
