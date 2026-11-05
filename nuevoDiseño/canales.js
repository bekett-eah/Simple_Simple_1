/* Nivel de cada trámite (número del catálogo) para el aviso por WhatsApp.
   Por WhatsApp no se hace ningún trámite: el asistente (Indexlogin.html) solo avisa cuando el trámite finaliza.
   Niveles tomados de tramites-whatsapp-simple-sv.md: v = verde y a = amarillo (el aviso nombra el trámite),
   r = rojo (información sensible: el aviso es genérico y no nombra el trámite).
   judiciales: relacionados con procesos judiciales o de familia; el aviso tampoco los nombra y nunca se envían documentos.
   Conteo: 60 verdes, 36 amarillos, 22 rojos. */
window.CANAL_WHATSAPP = {
  niveles: {1:'v',2:'v',3:'v',4:'v',5:'v',6:'v',7:'a',8:'a',9:'v',10:'a',11:'a',12:'a',13:'a',14:'a',15:'a',16:'a',17:'a',18:'v',19:'v',20:'v',21:'v',22:'v',23:'v',24:'v',25:'v',26:'v',27:'v',28:'v',29:'v',30:'v',31:'v',32:'v',33:'v',34:'v',35:'a',36:'a',37:'v',38:'v',39:'v',40:'v',41:'v',42:'v',43:'v',44:'v',45:'v',46:'v',47:'v',48:'v',49:'a',50:'a',51:'v',52:'a',53:'a',54:'v',55:'v',56:'r',57:'r',58:'r',59:'r',60:'r',61:'a',62:'v',63:'v',64:'v',65:'v',66:'v',67:'v',68:'v',69:'a',70:'v',71:'v',72:'v',73:'r',74:'r',75:'r',76:'r',77:'r',78:'r',79:'v',80:'v',81:'a',82:'a',83:'a',84:'a',85:'a',86:'a',87:'a',88:'r',89:'r',90:'r',91:'a',92:'a',93:'r',94:'r',95:'r',96:'r',97:'v',98:'v',99:'r',100:'r',101:'a',102:'a',103:'a',104:'v',105:'v',106:'v',107:'a',108:'v',109:'a',110:'a',111:'r',112:'a',113:'a',114:'a',115:'v',116:'r',117:'v',118:'v',},
  judiciales: [69, 93, 94]
};
