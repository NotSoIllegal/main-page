class RayTracer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        
        if (!this.gl) {
            alert('WebGL not supported');
            return;
        }

        this.setupWebGL();
        this.createScene();
        this.setupControls();
        this.render();
    }

    setupWebGL() {
        const gl = this.gl; // WebGL setup
        
        const vertexShaderSource = `
            attribute vec4 aVertexPosition;
            void main() {
                gl_Position = aVertexPosition;
            }
        `;

        const fragmentShaderSource = `
            precision highp float;
            
            uniform vec2 uResolution;
            uniform vec3 uCameraPosition;
            uniform vec3 uCameraTarget;
            uniform float uTime;
            
            struct Sphere {
                vec3 center;
                float radius;
                vec3 color;
                float reflectivity;
            };
            
            struct Light {
                vec3 position;
                vec3 color;
                float intensity;
            };
            
            const int NUM_SPHERES = 5;
            const int NUM_LIGHTS = 2;
            
            Sphere spheres[NUM_SPHERES];
            Light lights[NUM_LIGHTS];
            
            void initScene() {
                spheres[0] = Sphere(vec3(0.0, 0.0, 0.0), 1.0, vec3(1.0, 0.0, 0.0), 0.8);
                spheres[1] = Sphere(vec3(-2.0, -1.5, 1.0), 0.8, vec3(0.0, 1.0, 0.0), 0.6);
                spheres[2] = Sphere(vec3(2.5, -1.0, -0.5), 1.2, vec3(0.0, 0.0, 1.0), 0.9);
                spheres[3] = Sphere(vec3(0.0, -101.0, 0.0), 100.0, vec3(0.5, 0.5, 0.5), 0.3);
                spheres[4] = Sphere(vec3(-3.0, 1.5, 2.0), 0.5, vec3(1.0, 1.0, 0.0), 0.7);
                
                lights[0] = Light(vec3(5.0, 10.0, -5.0), vec3(1.0, 1.0, 1.0), 1.0);
                lights[1] = Light(vec3(-5.0, 5.0, 5.0), vec3(0.5, 0.5, 1.0), 0.8);
            }
            
            float intersectSphere(vec3 rayOrigin, vec3 rayDirection, Sphere sphere) {
                vec3 oc = rayOrigin - sphere.center;
                float a = dot(rayDirection, rayDirection);
                float b = 2.0 * dot(oc, rayDirection);
                float c = dot(oc, oc) - sphere.radius * sphere.radius;
                float discriminant = b * b - 4.0 * a * c;
                
                if (discriminant < 0.0) {
                    return -1.0;
                }
                
                return (-b - sqrt(discriminant)) / (2.0 * a);
            }
            
            vec3 castRay(vec3 rayOrigin, vec3 rayDirection, int depth) {
                float tMin = 1e20;
                Sphere hitSphere = spheres[0];
                bool hit = false;
                
                for (int i = 0; i < NUM_SPHERES; i++) {
                    float t = intersectSphere(rayOrigin, rayDirection, spheres[i]);
                    if (t > 0.001 && t < tMin) {
                        tMin = t;
                        hitSphere = spheres[i];
                        hit = true;
                    }
                }
                
                if (!hit) {
                    float gradient = 0.5 * (rayDirection.y + 1.0);
                    return mix(vec3(0.8, 0.9, 1.0), vec3(0.3, 0.4, 0.6), gradient);
                }
                vec3 hitPoint = rayOrigin + rayDirection * tMin;
                vec3 normal = normalize(hitPoint - hitSphere.center);
                
                vec3 color = vec3(0.0);
                
                for (int i = 0; i < NUM_LIGHTS; i++) {
                    Light light = lights[i];
                    vec3 lightDir = normalize(light.position - hitPoint);
                    float distance = length(light.position - hitPoint);
                    
                    float shadow = 0.0;
                    for (int j = 0; j < NUM_SPHERES; j++) {
                        vec3 shadowRayOrigin = hitPoint + normal * 0.001;
                        float t = intersectSphere(shadowRayOrigin, lightDir, spheres[j]);
                        if (t > 0.0 && t < distance) {
                            shadow = 1.0;
                            break;
                        }
                    }
                    
                    if (shadow == 0.0) {
                        float diffuse = max(dot(normal, lightDir), 0.0);
                        vec3 viewDir = normalize(rayOrigin - hitPoint);
                        vec3 reflectDir = reflect(-lightDir, normal);
                        float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
                        
                        color += hitSphere.color * light.color * light.intensity * (diffuse + specular * 0.5);
                    }
                }
                
                color += vec3(0.1) * hitSphere.color;
                
                return color;
            }
            
            void main() {
                initScene();
                
                vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.y, uResolution.x);
                
                vec3 cameraPos = uCameraPosition;
                vec3 cameraTarget = uCameraTarget;
                vec3 cameraUp = vec3(0.0, 1.0, 0.0);
                
                vec3 w = normalize(cameraPos - cameraTarget);
                vec3 u = normalize(cross(cameraUp, w));
                vec3 v = cross(w, u);
                
                vec3 rayDirection = normalize(uv.x * u + uv.y * v - 2.0 * w);
                
                vec3 color = castRay(cameraPos, rayDirection, 0);
                
                color = pow(color, vec3(1.0 / 2.2));
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;

        this.vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
        this.fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = this.createProgram(this.vertexShader, this.fragmentShader);
        
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1
        ]);

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        this.aVertexPosition = gl.getAttribLocation(this.program, 'aVertexPosition');
        this.uResolution = gl.getUniformLocation(this.program, 'uResolution');
        this.uCameraPosition = gl.getUniformLocation(this.program, 'uCameraPosition');
        this.uCameraTarget = gl.getUniformLocation(this.program, 'uCameraTarget');
        this.uTime = gl.getUniformLocation(this.program, 'uTime');
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }

    createProgram(vertexShader, fragmentShader) {
        const gl = this.gl;
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }
        
        return program;
    }

    createScene() {
        this.cameraPosition = { x: 0, y: 0, z: 10 };
        this.cameraTarget = { x: 0, y: 0, z: 0 };
        this.time = 0;
    }

    setupControls() {
        const cameraX = document.getElementById('cameraX');
        const cameraY = document.getElementById('cameraY');
        const cameraZ = document.getElementById('cameraZ');

        cameraX.addEventListener('input', (e) => {
            this.cameraPosition.x = parseFloat(e.target.value);
            this.render();
        });

        cameraY.addEventListener('input', (e) => {
            this.cameraPosition.y = parseFloat(e.target.value);
            this.render();
        });

        cameraZ.addEventListener('input', (e) => {
            this.cameraPosition.z = parseFloat(e.target.value);
            this.render();
        });
    }

    render() {
        const gl = this.gl;
        const canvas = this.canvas;

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.aVertexPosition);
        gl.vertexAttribPointer(this.aVertexPosition, 2, gl.FLOAT, false, 0, 0);

        gl.uniform2f(this.uResolution, canvas.width, canvas.height);
        gl.uniform3f(this.uCameraPosition, 
            this.cameraPosition.x, 
            this.cameraPosition.y, 
            this.cameraPosition.z);
        gl.uniform3f(this.uCameraTarget, 
            this.cameraTarget.x, 
            this.cameraTarget.y, 
            this.cameraTarget.z);
        gl.uniform1f(this.uTime, this.time);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        this.time += 0.01;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const rayTracer = new RayTracer(canvas);
});
