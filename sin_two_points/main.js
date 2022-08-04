let dist_square = function(a,b){
    return a*a+b*b;
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


class Point{
    constructor(container,x,y){
        this.container = container;
        this.x = Math.floor(x);
        this.y = Math.floor(y);
    }
    r = 4;
    collision_r = 20;
    hovering = false;
    mousedown(x,y){
        let that = this;
        this.x = x;
        this.y = y;
        let {container} = this;
        //we wnat to remove other events
        container.disableEvents = true;
        let evt1 = container.on("mousemove",(x,y)=>{
            that.x = x;
            that.y = y;
            container.render();
        });
        let evt2 = container.on("mouseup",(x,y)=>{
            evt1.remove();
            evt2.remove();
            container.render();
            container.disableEvents = false;
        });
    }
    mousemove(){}
    mouseup(){}
    mouseenter(){
        this.hovering = true;
        this.container.render();
    }
    mouseleave(){
        this.hovering = false;
        this.container.render();
    }
    isColliding(x,y){
        let dx = x-this.x;
        let dy = y-this.y;
        return dist_square(dx,dy) < this.collision_r*this.collision_r;
    }
    color = "#000";
    label = "";
    render(){
        let {container,x,y,r,hovering} = this;
        let {ctx,canvas} = container;
        if(hovering)r *= 1.2;//enlarge on hover
        ctx.beginPath();
        ctx.arc(x,y,r,0,Math.PI*2);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.fillStyle = "#008";
        ctx.fillText(this.label,x+10,y);
        ctx.fillText(`x: ${x}, y: ${container.h-y}`,x+10,y+16);
    }
}

class Widget extends ResizableCanvas{
    disableEvents = false;
    constructor(){
        super();
        let that = this;
        this.once("resize",(w,h)=>{
            console.log(w,h);
            that.initialize(w,h);
        });
    }
    initialize(w,h){
        console.log(w,h);
        let that = this;
        //add three point, and draw lines between, and show the sine value
        let p0 = new Point(this,w*0.8,h*0.2);//center point
        let p1 = new Point(this,w*0.2,h*0.5);
        let p2 = new Point(this,w*0.5,h*0.7);
        p0.label = "p0";
        p1.label = "p1";
        p2.label = "p2";
        p0.color = "#f00";
        p1.color = "#0f0";
        p2.color = "#00f";
        this.p0 = p0;
        this.p1 = p1;
        this.p2 = p2;
        this.points = [p0,p1,p2];
        
        let prevPointed = null;
        this.on("mousemove", (x,y) => {
            if(that.disableEvents)return;
            let pointed = that.getPointed(x, y);
            if (pointed !== prevPointed) {
                if(prevPointed)prevPointed.mouseleave(x, y);
                if(pointed)pointed.mouseenter(x, y);
                prevPointed = pointed;
            }
            if(pointed)pointed.mousemove(x, y);
        });
        this.on("mousedown", (x,y) => {
            if(that.disableEvents)return;
            let pointed = that.getPointed(x, y);
            if (!pointed) return;
            pointed.mousedown(x, y);
        });
        this.on("mouseup", (x,y) => {
            if(that.disableEvents)return;
            let pointed = that.getPointed(x, y);
            if (!pointed) return;
            pointed.mouseup(x, y);
        });
        this.on("resize",() => {
            that.render();
        });
    }
    getPointed(x,y){
        for(let point of this.points){
            if(point.isColliding(x,y))return point;
        }
        return null;
    }
    render(){
        let that = this;
        let {p0,p1,p2,ctx,canvas,w,h} = this;
        ctx.clearRect(0,0,w,h);
        //draw lines between points
        ctx.beginPath();
        ctx.moveTo(p1.x,p1.y);
        ctx.lineTo(p0.x,p0.y);
        ctx.lineTo(p2.x,p2.y);
        ctx.strokeStyle = "#000";
        ctx.stroke();
        
        for(let point of this.points){
            point.render();
        }
        
        
        let x1 = p1.x-p0.x;
        let y1 = -(p1.y-p0.y);//correcting y
        let x2 = p2.x-p0.x;
        let y2 = -(p2.y-p0.y);
        
        let r1_square = dist_square(x1,y1);
        let r2_square = dist_square(x2,y2);
        //both based on r1 and r2
        let sin = (-y1*x2+x1*y2)/Math.sqrt(r1_square*r2_square);
        let cos = (x1*x2+y1*y2)/Math.sqrt(r1_square*r2_square);
        //write out the stats
        ctx.fillText(`Drag each points!`,10,20);
        ctx.fillText(`cos and sin value from p1 to p2 in counterclockwise (as in cartesian coordinates)`,10,20+15);
        ctx.fillText(`cos: ${cos}`,10,20+15*2);
        ctx.fillText(`sin: ${sin}`,10,20+15*3);
    }
};


let main = async function(){
    let body = new ELEM_AddHooks(document.body).style("overflow:hidden;");
    widget = body.add(new Widget().style("width:100vw;height:100vh"));
};

main();