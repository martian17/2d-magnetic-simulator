let dist_square = function(x,y){
    return x*x+y*y;
};

let dist = function(x,y){
    return Math.sqrt(dist_square(x,y));
};

let crossProduct3D = function([x1,y1,z1],[x2,y2,z2]){
    let x = y1*z2 - z1*y2;
    let y = z1*x2 - x1*z2;
    let z = x1*y2 - y1*x2;
    return [x,y,z];
};

class Hooks{
    hooks = new Map();
    add(cb){
        this.hooks.set(cb,true);
        let that = this;
        return {
            remove:()=>{
                that.hooks.delete(cb);
            },cb
        };
    }
    trigger(){
        for(let [cb] of this.hooks[Symbol.iterator]()){
            cb(...arguments);
        }
    }
};


class ELEM_AddHooks extends ELEM{
    addHooks = new Hooks();
    onAdd(cb){
        return this.addHooks.add(cb);
    }
    add(){
        let elem = super.add(...arguments);
        if(!(elem instanceof ELEM_AddHooks))return elem;
        elem.addHooks.trigger();
        return elem;
    }
};

class ResizableCanvas extends ELEM_AddHooks{
    constructor(w0,h0){
        super("div");
        let that = this;
        let canvas = this.add("canvas").e;
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        
        window.addEventListener("resize",()=>{
            that.updateSize();
        });
        this.onAdd(()=>{
            that.updateSize();
        });
        this.native_on = super.on;
    }
    resizeHooks = new Hooks();
    updateSize(){
        let box = this.e.getBoundingClientRect();
        this.canvas.width = box.width;
        this.canvas.height = box.height;
        this.w = box.width;
        this.h = box.height;
        this.resizeHooks.trigger(box.width,box.height);
    }
    
    on(evt,cb){
        let that = this;
        if(evt === "resize"){
            return this.resizeHooks.add(cb);
        }else if(evt === "click"){
            return this.native_on("click",(e)=>{
                cb(...that.evtToCoords(e));
            });
        }
        let table = {
            mousemove:"touchmove",
            mousedown:"touchstart",
            mouseup:"touchend"
        };
        let mouse = (e)=>{
            cb(...that.evtToCoords(e));
        };
        let touch = (e)=>{
            cb(...that.touchEvtToCoords(e));
        };
        let moouse_evt = this.native_on(evt,mouse);
        let touch_evt = this.native_on(table[evt],touch);
        return {
            remove:()=>{
                moouse_evt.remove();
                touch_evt.remove();
            },
            cb:cb
        };
    }
    once(evt,cb){
        let e = this.on(evt,function(){//not arrow because it uses arguments
            e.remove();
            cb(...arguments);
        });
    }
    evtToCoords(e) {
        let rect = this.canvas.getBoundingClientRect();
        let x = e.pageX - window.scrollX - rect.left; //x position within the element.
        let y = e.pageY - window.scrollY - rect.top; //y position within the element.
        return [x, y];
    }
    txy=[0,0];
    touchEvtToCoords(e) {
        let rect = this.canvas.getBoundingClientRect();
        let x,y;
        if(e.touches[0]){
            x = e.touches[0].pageX - window.scrollX - rect.left; //x position within the element.
            y = e.touches[0].pageY - window.scrollY - rect.top; //y position within the element.
        }else{
            [x,y] = this.txy;
        }
        this.txy = [x,y];
        return [x,y];
    }
};


let metersToUnits = function(n,order){//i.e. 5000 => 5km
    let units = [
        "ym",//1e-24
        "zm",
        "am",
        "fm",
        "pm",
        "nm",
        "??m",
        "mm",
        "m",
        "km"
    ];
    if(order < -24 || order > +7){
        //show scientific notation
        return `${n.toExponential()} m`;
    }else if(order > +3){//use km
        return `${Math.round(n*1e-3)} km`;
    }else if(order === -2 || order === -1){
        return `${Math.round(n*100)} cm`;
    }else{
        let unitNumber = Math.floor((order+24)/3);
        let multiplier = 10**(-(unitNumber-8)*3);
        return `${Math.round(n*multiplier)} ${units[unitNumber]}`;
    }
};

class Simulator extends ResizableCanvas{
    constructor(){
        super();
        let that = this;
        //this will be called once this.w and this.h are defined
        /*this.once("resize",(w,h)=>{
            console.log(w,h);
            that.initialize(w,h);
        });*/
    }
    initialize(){
        let {w,h,virtual_width} = this;
        //do initialization stuff
        let that = this;
        this.on("resize",()=>{
            this.draw();
        });
        this.on("click",(px,py)=>{
            let [x,y] = this.pixelToCoord(px,py);
            console.log(`x: ${x} m, y: ${y} m, B: ${this.calculateIntensity(x,y)} T`);
        });
        this.draw();
    }
    cx = 0;
    cy = 0;
    virtual_width = 10;
    updateDisplayProperty(){
        this.pixelSize = this.virtual_width/this.w;
        this.unitSize = this.w/this.virtual_width;
    }
    coordToPixel(x,y){
        let {unitSize,cx,cy,virtual_width,w,h} = this;
        let px = (x-cx) * unitSize + w/2;
        let py = (y-cy) * unitSize + h/2;
        return [px,py];
    }
    pixelToCoord(px,py){
        let {pixelSize,cx,cy,virtual_width,w,h} = this;
        let x = (px-w/2) * pixelSize + cx;
        let y = (py-h/2) * pixelSize + cy;
        return [x,y];
    }
    draw(){
        this.updateDisplayProperty();
        let {cx,cy,virtual_width,ctx,spline,w,h} = this;
        ctx.clearRect(0,0,w,h);
        let imgdata = ctx.getImageData(0,0,w,h);
        let data = imgdata.data;
        /*for(let py = 0; py < imgdata.height; py++){
            for(let px = 0; px < imgdata.width; px++){
                let [x,y] = this.pixelToCoord(px,py);
                let [r,g,b] = this.getColor(this.calculateIntensity(x,y));
                let idx = (py*w+px)*4;
                data[idx+0] = r;
                data[idx+1] = g;
                data[idx+2] = b;
                data[idx+3] = 255;
            }
        }*/
        ctx.putImageData(imgdata,0,0);
        
        ctx.beginPath();
        for(let [x,y] of spline){
            let [px,py] = this.coordToPixel(x,y);
            ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.stroke();
        
        this.drawScale();
    }
    maxScaleRatio = 0.5;
    minimalScaleSpacing = 50;//px
    drawScale(){
        let {ctx,w,h,minimalScaleSpacing,maxScaleRatio,virtual_width} = this;
        // spacingSize0: calculate pixel size, then multiply with spacing
        let spacingSize0 = minimalScaleSpacing*(virtual_width/w);
        let ten_scaling = 10**Math.ceil(Math.log(spacingSize0)/Math.log(10));
        let two_scaling = 10**Math.ceil(Math.log(spacingSize0/2)/Math.log(10))*2;
        let five_scaling = 10**Math.ceil(Math.log(spacingSize0/5)/Math.log(10))*5;
        
        let scaling = ten_scaling;
        if(Math.abs(two_scaling-spacingSize0) < Math.abs(scaling-spacingSize0)){
            scaling = two_scaling;
        }else if(Math.abs(five_scaling-spacingSize0) < Math.abs(scaling-spacingSize0)){
            scaling = five_scaling;
        }
        
        let order = Math.floor(Math.log(scaling)/Math.log(10));
        
        ctx.beginPath();
        let prevX, prevY;
        for(let s = 0; s < virtual_width*maxScaleRatio; s += scaling){
            let label = metersToUnits(s,order);
            let xx = s*(w/virtual_width);//convert to pixel
            let x = xx + 30;//margin left 30
            let y = h - 30;//margin bottom 30
            ctx.beginPath()
            if(s !== 0){
                ctx.moveTo(prevX,prevY);
            }
            ctx.lineTo(x,y);
            ctx.lineTo(x,y-20);
            ctx.stroke();
            [prevX, prevY] = [x,y];
            //draw the label
            ctx.fillText(label,x-10,y-23);
        }
    }
    sigmoid_r = 100;//some random value
    getColor(v){
        //first calculate sigmoid
        let vv = 1/(1+Math.E**(-Math.E/this.sigmoid_r*v));
        let cc = Math.floor(vv*255);
        return [cc,255-cc,255-cc];
    }
    spline = null;
    current = 1;//1 ampere
    calculateIntensity(x,y){
        let {spline,current} = this;
        if(!spline)return 0;
        //if(Math.random() < 0.001)console.log((x+y)*100);
        
        //dummy return value
        //return (x+y)/this.virtual_width*100;
        
        // do da math
        // Biot-Savart law
        // B = ??0/(4??)???(Idl x r')/(r'^3)
        
        //2 dimensional code without xsum and ysum
        let zsum = 0;
        let mu0 = 1.25663706212e-6;
        let coef = mu0/(Math.PI*4);
        for(let i = 0; i < spline.length-1; i++){
            
            let [x1,y1] = spline[i];
            let [x2,y2] = spline[(i+1)%spline.length];
            
            let rx = x - (x1+x2)/2;
            let ry = y - (y1+y2)/2;
            
            let dx = x2-x1;
            let dy = y2-y1;
            
            let r = dist(rx,ry);
            
            // Biot-Savart law
            //only extracting z component
            //parenthesis: z component of cross product of Idl[] and displacement r'[]
            zsum += (current*dx*ry - current*dy*rx) / (r*r*r);
        }
        zsum *= coef;
        return zsum;
    }
}

let simulator;

let main = async function(){
    let body = new ELEM_AddHooks(document.body);
    simulator = body.add(new Simulator().style("width:100vw;height:70vh"));
    
    
    //defining wire segments
    let long_wire = (()=>{
        let s = [];
        let len = 10;//meters
        let n = 1000;//split into 1000 segments
        for(let i = 0; i < n; i++){
            s.push([0,i*len/n-5]);
        }
        return s;
    })();
    //long wire for testing purposes
    //check if it agrees with theoretical value
    //at 1 meter and 1 A of current, the field should be 2e-7 tesla
    //experimental result:
    //distance: 1.0041782729805013 meter
    //field strength: 1.9523041650110676e-7 tesla
    
    let createLoop = function(r,n){//r: radius, n: n segments
        let s = [];
        for(let i = 0; i < n; i++){
            let t = i/n;
            let rad = 2*Math.PI*t;
            s.push([Math.cos(rad)*r,Math.sin(rad)*r]);
        }
        s.push([...s[0]]);
        return s;
    };
    
    let earth_radius = 6371e+3;
    //let r = earth_radius;
    let r = 1;
    let loop = createLoop(r,1000);
    
    //simulator.spline = loop;
    simulator.spline = long_wire;
    simulator.current = 304186761.8134461;
    
    simulator.virtual_width = r*7;
    simulator.initialize();
};

main();