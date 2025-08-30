import * as THREE from "three";

export interface ViewCubeOptions {
    size?: number;
    position?: { x: number; y: number };
    backgroundColor?: number;
    faceColors?: { [key: string]: number };
    animationDuration?: number;
    showZoomControls?: boolean;
}

export class ViewCube {
    private container: HTMLElement;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private cube!: THREE.Group;
    private mainCubeMesh!: THREE.Mesh; // Reference to the main cube mesh for raycasting
    private mainCamera: THREE.Camera;
    private mainControls: any;
    private options: Required<ViewCubeOptions>;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private hoveredFace: number | null = null;
    private isTransitioning: boolean = false;

    private isAnimating: boolean = false;
    private animationId: number | null = null;
    private zoomControlsContainer: HTMLElement | null = null;
    private arrowControlsContainer: HTMLElement | null = null;
    private ifcViewer: any; // Reference to IFCViewer for zoom controls

    // Drag state
    private isDragging: boolean = false;
    private dragStartPosition: THREE.Vector2 = new THREE.Vector2();
    private dragCurrentPosition: THREE.Vector2 = new THREE.Vector2();
    private dragSensitivity: number = 1.5; // Even more sensitive for fast, responsive drag rotation
    private dragDeltaX: number = 0;
    private dragDeltaY: number = 0;
    private modelCenter: THREE.Vector3 = new THREE.Vector3();
    private initialCameraPosition: THREE.Vector3 = new THREE.Vector3();
    private initialCameraTarget: THREE.Vector3 = new THREE.Vector3();
    private currentRotationAngle: number = 0;
    private targetRotationAngle: number = 0;
    private rotationSmoothing: number = 0.3; // Reduced smoothing for more immediate response



    // Click prevention during/after dragging
    private wasJustDragging: boolean = false;

    // Drag tolerance for better UX when mouse leaves cube area
    private dragTolerance: number = 200; // pixels - how far mouse can wander before drag ends
    private documentMouseMoveHandler: ((event: MouseEvent) => void) | null = null;
    private documentMouseUpHandler: ((event: MouseEvent) => void) | null = null;

    // Drag detection
    private hasMouseMoved: boolean = false;
    private dragThreshold: number = 3; // pixels - min movement to consider it a drag

    // Face indices for raycasting
    private readonly FACE_INDICES = {
        RIGHT: 0,
        LEFT: 1,
        TOP: 2,
        BOTTOM: 3,
        FRONT: 4,
        BACK: 5
    };

    // Predefined view positions relative to model center
    // These are normalized direction vectors that will be scaled by camera distance
    private readonly VIEW_POSITIONS = {
        FRONT: new THREE.Vector3(0, 0, 1),
        BACK: new THREE.Vector3(0, 0, -1),
        LEFT: new THREE.Vector3(-1, 0, 0),
        RIGHT: new THREE.Vector3(1, 0, 0),
        TOP: new THREE.Vector3(0, 1, 0.001), // Slight offset to avoid gimbal lock
        BOTTOM: new THREE.Vector3(0, -1, 0.001) // Slight offset to avoid gimbal lock
    };



    constructor(container: HTMLElement, mainCamera: THREE.Camera, mainControls: any, ifcViewer: any, options: ViewCubeOptions = {}) {

        this.container = container;
        this.mainCamera = mainCamera;
        this.mainControls = mainControls;
        this.ifcViewer = ifcViewer;

        this.options = {
            size: options.size || 120,
            position: options.position || { x: 20, y: 20 },
            backgroundColor: options.backgroundColor || 0x2a2a2a,
            faceColors: {
                front: 0x4a90e2,
                back: 0xe24a4a,
                left: 0x4ae24a,
                right: 0xe2e24a,
                top: 0xe24ae2,
                bottom: 0x4ae2e2,
                ...options.faceColors
            },
            animationDuration: options.animationDuration || 600,
            showZoomControls: options.showZoomControls !== false // Default to true
        };

        // Initialize raycaster and mouse for face detection
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();



        this.init();
    }

    private init(): void {
        this.setupScene();
        this.createCube();
        this.setupEventListeners();

        if (this.options.showZoomControls) {
            this.createZoomControls();
        }
        this.updateModelCenter();
        this.updateCubeOrientation();
        this.createArrowControls();
        this.render();
    }

    private setupScene(): void {
        // Create scene for view cube
        this.scene = new THREE.Scene();

        // No background - let the 3D scene show through
        this.scene.background = null;

        // Create camera for view cube
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        this.camera.position.set(0, 0, 3);

        // Create renderer for view cube - Apple Liquid Glass
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            precision: "highp"
        });
        this.renderer.setSize(this.options.size, this.options.size);
        this.renderer.setClearColor(0x000000, 0); // Fully transparent background

        // Premium rendering settings for glass
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        // Position the view cube as a clean overlay on the 3D canvas
        const canvasElement = this.renderer.domElement;
        canvasElement.style.position = 'absolute';
        canvasElement.style.top = `${this.options.position.y}px`;
        canvasElement.style.right = `${this.options.position.x}px`;
        canvasElement.style.zIndex = '10000'; // Very high z-index to ensure it's on top
        canvasElement.style.cursor = 'grab';
        canvasElement.style.pointerEvents = 'auto';

        // Clean, minimal styling - no background, no borders, just the cube
        canvasElement.style.borderRadius = '0px';
        canvasElement.style.boxShadow = 'none';
        canvasElement.style.background = 'transparent';
        canvasElement.style.userSelect = 'none';
        canvasElement.style.webkitUserSelect = 'none';

        // Ensure it's added to the same parent as the main renderer
        if (this.container.querySelector('canvas')) {
            // Add as sibling to main canvas
            this.container.appendChild(canvasElement);
        } else {
            this.container.appendChild(canvasElement);
        }
    }

    private createCube(): void {
        // Create cube geometry
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        // Create glass-like materials for each face
        const glassMaterials = this.createGlassMaterials();

        // Create cube mesh with glass materials
        this.mainCubeMesh = new THREE.Mesh(geometry, glassMaterials);
        this.cube = new THREE.Group();
        this.cube.add(this.mainCubeMesh);

        // Add inner glow cube
        this.createInnerGlow(geometry);

        // Add rim lighting effect
        this.createRimLight(geometry);

        this.scene.add(this.cube);

        // Enhanced lighting setup for glass effects
        this.setupGlassLighting();
    }

    private createGlassMaterials(): THREE.Material[] {
        // Create Apple Liquid Glass materials with subtle face distinction
        const createFaceMaterial = (tint: THREE.Color) => {
            return new THREE.MeshPhysicalMaterial({
                // Apple Liquid Glass properties
                transmission: 0.88,           // High but not too high for visibility
                opacity: 0.92,               // Slightly more opaque for better visibility
                metalness: 0.0,             // Pure glass, no metal
                roughness: 0.0,             // Perfectly smooth surface
                ior: 1.45,                  // Glass refractive index
                thickness: 0.1,             // Thin glass

                // Very subtle tinting for face distinction
                color: tint,
                emissive: new THREE.Color(0x111111), // Very subtle inner glow
                emissiveIntensity: 0.05,

                // Reflections and environment mapping
                envMapIntensity: 0.8,      // Strong but not overwhelming reflections
                clearcoat: 1.0,            // Maximum clear coat
                clearcoatRoughness: 0.0,   // Perfect clear coat

                // Premium glass properties
                side: THREE.DoubleSide,
                transparent: true,
                depthWrite: true,
                depthTest: true,
            });
        };

        // Very subtle tints for each face - barely visible but helps with orientation
        return [
            createFaceMaterial(new THREE.Color(0xffffff)), // Right - pure white
            createFaceMaterial(new THREE.Color(0xfafafa)), // Left - slight gray
            createFaceMaterial(new THREE.Color(0xf8f8ff)), // Top - slight blue
            createFaceMaterial(new THREE.Color(0xfff8f8)), // Bottom - slight red
            createFaceMaterial(new THREE.Color(0xf8fff8)), // Front - slight green
            createFaceMaterial(new THREE.Color(0xfffff8))  // Back - slight yellow
        ];
    }

    private createInnerGlow(_geometry: THREE.BoxGeometry): void {
        // Create a subtle inner reflection effect
        const innerGeometry = new THREE.BoxGeometry(0.97, 0.97, 0.97);
        const innerMaterial = new THREE.MeshPhysicalMaterial({
            transmission: 0.99,
            opacity: 0.95,
            metalness: 0.0,
            roughness: 0.0,
            ior: 1.9,
            thickness: 0.02,
            color: new THREE.Color(0xffffff),
            envMapIntensity: 0.8,
            clearcoat: 0.8,
            clearcoatRoughness: 0.1,
            side: THREE.BackSide,
            transparent: true,
        });

        const innerGlow = new THREE.Mesh(innerGeometry, innerMaterial);
        this.cube.add(innerGlow);
    }

    private createRimLight(geometry: THREE.BoxGeometry): void {
        // Create subtle edge highlighting for glass definition
        const edges = new THREE.EdgesGeometry(geometry);

        // Create more visible rim light for better cube definition
        const rimMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6,  // More visible edges
            linewidth: 3,  // Thicker lines
        });

        const rimLight = new THREE.LineSegments(edges, rimMaterial);
        rimLight.scale.setScalar(1.002); // Very slight edge enhancement
        this.cube.add(rimLight);

        // Add face labels for better orientation
        this.addFaceLabels();
    }

    private addFaceLabels(): void {
        // Face labels removed for cleaner appearance
        // The ViewCube still supports clicking on faces for navigation
    }

    private setupGlassLighting(): void {
        // Clean, minimal lighting for Apple Liquid Glass
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Soft key light from top-front
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
        keyLight.position.set(1, 1, 2);
        keyLight.castShadow = false;
        this.scene.add(keyLight);

        // Subtle fill light from bottom
        const fillLight = new THREE.DirectionalLight(0xf8f8ff, 0.3);
        fillLight.position.set(0, -1, 0);
        this.scene.add(fillLight);

        // Very subtle accent light
        const accentLight = new THREE.PointLight(0xffffff, 0.2, 8);
        accentLight.position.set(2, 2, 2);
        this.scene.add(accentLight);
    }

    private setupEventListeners(): void {
        const canvas = this.renderer.domElement;

        // Mouse down handler for drag start and click detection
        const mousedownHandler = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            this.onMouseDown(event);
        };

        // Mouse move handler for drag and hover
        const mousemoveHandler = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (this.isDragging) {
                this.onDragMove(event);
            } else {
                // Check for face hover when not dragging
                this.checkFaceHover(event);
            }
        };

        // Mouse up handler for drag end and click
        const mouseupHandler = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            this.onMouseUp(event);
        };

        // Click handler for face selection
        const clickHandler = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();

            // Only process clicks if not dragging and not transitioning
            if (!this.wasJustDragging && !this.isDragging && !this.isTransitioning) {
                this.onFaceClick(event);
            }
        };

        // Add event listeners with capture phase to ensure they fire first
        canvas.addEventListener('mousedown', mousedownHandler, true);
        canvas.addEventListener('mousemove', mousemoveHandler, true);
        canvas.addEventListener('mouseup', mouseupHandler, true);
        canvas.addEventListener('click', clickHandler, true);
        canvas.addEventListener('wheel', (e) => { e.stopPropagation(); e.preventDefault(); }, true);

        // Touch events for mobile support (drag only)
        canvas.addEventListener('touchstart', (e) => { e.stopPropagation(); e.preventDefault(); }, true);
    }

    private createZoomControls(): void {
        this.zoomControlsContainer = document.createElement('div');
        this.zoomControlsContainer.style.position = 'absolute';
        this.zoomControlsContainer.style.top = `${this.options.position.y}px`;
        this.zoomControlsContainer.style.right = `${this.options.position.x + this.options.size + 10}px`;
        this.zoomControlsContainer.style.zIndex = '10001'; // Higher than ViewCube
        this.zoomControlsContainer.style.display = 'flex';
        this.zoomControlsContainer.style.flexDirection = 'column';
        this.zoomControlsContainer.style.gap = '6px';
        this.zoomControlsContainer.style.background = 'transparent';
        this.zoomControlsContainer.style.padding = '0';
        this.zoomControlsContainer.style.pointerEvents = 'auto';

        // Zoom In button
        const zoomInBtn = this.createZoomButton('+', 'Zoom In');
        zoomInBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.ifcViewer && this.ifcViewer.zoomIn) {
                this.ifcViewer.zoomIn();
            }
        });

        // Zoom Out button
        const zoomOutBtn = this.createZoomButton('-', 'Zoom Out');
        zoomOutBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.ifcViewer && this.ifcViewer.zoomOut) {
                this.ifcViewer.zoomOut();
            }
        });

        // Zoom to Fit button
        const zoomFitBtn = this.createZoomButton('⤢', 'Zoom to Fit');
        zoomFitBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.ifcViewer && this.ifcViewer.zoomToFit) {
                this.ifcViewer.zoomToFit();
            }
        });

        this.zoomControlsContainer.appendChild(zoomInBtn);
        this.zoomControlsContainer.appendChild(zoomOutBtn);
        this.zoomControlsContainer.appendChild(zoomFitBtn);

        this.container.appendChild(this.zoomControlsContainer);
    }

    private createArrowControls(): void {
        this.arrowControlsContainer = document.createElement('div');
        this.arrowControlsContainer.style.position = 'absolute';
        this.arrowControlsContainer.style.top = `${this.options.position.y + this.options.size + 15}px`;
        this.arrowControlsContainer.style.right = `${this.options.position.x + this.options.size / 2 - 50}px`;
        this.arrowControlsContainer.style.zIndex = '10002'; // Higher than ViewCube and zoom controls
        this.arrowControlsContainer.style.display = 'flex';
        this.arrowControlsContainer.style.flexDirection = 'row';
        this.arrowControlsContainer.style.gap = '20px';
        this.arrowControlsContainer.style.alignItems = 'center';
        this.arrowControlsContainer.style.justifyContent = 'center';
        this.arrowControlsContainer.style.pointerEvents = 'auto';

        // Left arrow button
        const leftArrowBtn = this.createArrowButton('left');
        leftArrowBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.rotateLeft();
        });

        // Right arrow button
        const rightArrowBtn = this.createArrowButton('right');
        rightArrowBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.rotateRight();
        });

        this.arrowControlsContainer.appendChild(leftArrowBtn);
        this.arrowControlsContainer.appendChild(rightArrowBtn);

        this.container.appendChild(this.arrowControlsContainer);
    }

    private createArrowButton(direction: 'left' | 'right'): HTMLElement {
        const button = document.createElement('button');
        button.title = `Rotate ${direction}`;
        button.style.width = '40px';
        button.style.height = '40px';
        button.style.border = '1px solid rgba(255, 255, 255, 0.4)';
        button.style.borderRadius = '50%';
        button.style.background = 'rgba(42, 42, 42, 0.8)';
        button.style.color = 'rgba(255, 255, 255, 0.95)';
        button.style.cursor = 'pointer';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        button.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.3)';
        button.style.backdropFilter = 'blur(12px)';
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.style.fontSize = '18px';
        button.style.fontWeight = 'bold';

        // Create curved arrow using SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.style.fill = 'currentColor';

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        if (direction === 'left') {
            // Left curved arrow
            path.setAttribute('d', 'M20 12c0-1.1-.9-2-2-2H6.83l2.59-2.59L8 6l-6 6 6 6 1.41-1.41L6.83 14H18c.55 0 1-.45 1-1z');
        } else {
            // Right curved arrow
            path.setAttribute('d', 'M4 12c0 1.1.9 2 2 2h11.17l-2.59 2.59L16 18l6-6-6-6-1.41 1.41L17.17 10H6c-.55 0-1 .45-1 1z');
        }

        svg.appendChild(path);
        button.appendChild(svg);

        // Add subtle inner shadow for depth
        button.style.boxShadow = `
            0 1px 3px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `;

        button.addEventListener('mouseenter', (event) => {
            event.stopPropagation();
            button.style.background = 'rgba(255, 255, 255, 0.9)';
            button.style.borderColor = 'rgba(255, 255, 255, 0.8)';
            button.style.color = 'rgba(0, 0, 0, 0.9)';
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = `
                0 4px 20px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.3)
            `;
        });

        button.addEventListener('mouseleave', (event) => {
            event.stopPropagation();
            button.style.background = 'rgba(42, 42, 42, 0.8)';
            button.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            button.style.color = 'rgba(255, 255, 255, 0.95)';
            button.style.transform = 'scale(1)';
            button.style.boxShadow = `
                0 2px 12px rgba(0, 0, 0, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `;
        });

        button.addEventListener('mousedown', (event) => {
            event.stopPropagation();
            button.style.transform = 'scale(0.95)';
            button.style.background = 'rgba(255, 255, 255, 0.7)';
            button.style.color = 'rgba(0, 0, 0, 0.9)';
        });

        button.addEventListener('mouseup', (event) => {
            event.stopPropagation();
            button.style.transform = 'scale(1.05)';
            button.style.background = 'rgba(255, 255, 255, 0.9)';
            button.style.color = 'rgba(0, 0, 0, 0.9)';
        });

        return button;
    }

    private createZoomButton(text: string, title: string): HTMLElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.title = title;
        button.style.width = '32px';
        button.style.height = '32px';
        button.style.border = '1px solid rgba(255, 255, 255, 0.4)';
        button.style.borderRadius = '8px';
        button.style.background = 'rgba(42, 42, 42, 0.8)';
        button.style.color = 'rgba(255, 255, 255, 0.95)';
        button.style.cursor = 'pointer';
        button.style.fontSize = '16px';
        button.style.fontWeight = '500';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        button.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.3)';
        button.style.backdropFilter = 'blur(12px)';
        button.style.position = 'relative';
        button.style.overflow = 'hidden';

        // Add subtle inner shadow for depth
        button.style.boxShadow = `
            0 1px 3px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `;

        button.addEventListener('mouseenter', (event) => {
            event.stopPropagation();
            button.style.background = 'rgba(255, 255, 255, 0.9)';
            button.style.borderColor = 'rgba(255, 255, 255, 0.8)';
            button.style.color = 'rgba(0, 0, 0, 0.9)';
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = `
                0 4px 20px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.3)
            `;
        });

        button.addEventListener('mouseleave', (event) => {
            event.stopPropagation();
            button.style.background = 'rgba(42, 42, 42, 0.8)';
            button.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            button.style.color = 'rgba(255, 255, 255, 0.95)';
            button.style.transform = 'scale(1)';
            button.style.boxShadow = `
                0 2px 12px rgba(0, 0, 0, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `;
        });

        button.addEventListener('mousedown', (event) => {
            event.stopPropagation();
            button.style.transform = 'scale(0.98)';
            button.style.background = 'rgba(255, 255, 255, 0.7)';
            button.style.color = 'rgba(0, 0, 0, 0.9)';
        });

        button.addEventListener('mouseup', (event) => {
            event.stopPropagation();
            button.style.transform = 'scale(1.05)';
            button.style.background = 'rgba(255, 255, 255, 0.9)';
            button.style.color = 'rgba(0, 0, 0, 0.9)';
        });

        return button;
    }





    private checkFaceHover(event: MouseEvent): void {
        if (this.isTransitioning) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.mainCubeMesh);

        if (intersects.length > 0) {
            const faceIndex = intersects[0].face?.materialIndex;
            if (faceIndex !== undefined && faceIndex !== this.hoveredFace) {
                this.hoveredFace = faceIndex;
                this.updateFaceHighlight();
            }
        } else if (this.hoveredFace !== null) {
            this.hoveredFace = null;
            this.updateFaceHighlight();
        }
    }

    private updateFaceHighlight(): void {
        const canvas = this.renderer.domElement;
        if (this.hoveredFace !== null) {
            canvas.style.cursor = 'pointer';
            // Update material opacity for hover effect
            if (Array.isArray(this.mainCubeMesh.material)) {
                this.mainCubeMesh.material.forEach((mat, index) => {
                    if (mat instanceof THREE.MeshPhysicalMaterial) {
                        mat.opacity = index === this.hoveredFace ? 0.95 : 0.85;
                    }
                });
            }
        } else {
            canvas.style.cursor = this.isDragging ? 'grabbing' : 'grab';
            // Reset all materials to default opacity
            if (Array.isArray(this.mainCubeMesh.material)) {
                this.mainCubeMesh.material.forEach((mat) => {
                    if (mat instanceof THREE.MeshPhysicalMaterial) {
                        mat.opacity = 0.92;
                    }
                });
            }
        }
    }

    private onFaceClick(event: MouseEvent): void {
        if (this.isTransitioning) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.mainCubeMesh);

        if (intersects.length > 0) {
            const faceIndex = intersects[0].face?.materialIndex;
            if (faceIndex !== undefined) {
                this.navigateToFace(faceIndex);
            }
        }
    }

    private navigateToFace(faceIndex: number): void {
        let targetView: THREE.Vector3 | null = null;

        switch (faceIndex) {
            case this.FACE_INDICES.FRONT:
                targetView = this.VIEW_POSITIONS.FRONT;
                break;
            case this.FACE_INDICES.BACK:
                targetView = this.VIEW_POSITIONS.BACK;
                break;
            case this.FACE_INDICES.LEFT:
                targetView = this.VIEW_POSITIONS.LEFT;
                break;
            case this.FACE_INDICES.RIGHT:
                targetView = this.VIEW_POSITIONS.RIGHT;
                break;
            case this.FACE_INDICES.TOP:
                targetView = this.VIEW_POSITIONS.TOP;
                break;
            case this.FACE_INDICES.BOTTOM:
                targetView = this.VIEW_POSITIONS.BOTTOM;
                break;
        }

        if (targetView) {
            this.animateCameraToView(targetView);
        }
    }

    private animateCameraToView(viewDirection: THREE.Vector3): void {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        // Update model center
        this.updateModelCenter();

        // Calculate camera distance from current position
        const currentDistance = this.mainCamera.position.distanceTo(this.modelCenter);

        // Normalize the view direction
        const normalizedDirection = viewDirection.clone().normalize();

        // Calculate new camera position
        const newCameraPosition = new THREE.Vector3()
            .copy(normalizedDirection)
            .multiplyScalar(currentDistance)
            .add(this.modelCenter);

        // Store start positions
        const startPosition = this.mainCamera.position.clone();
        const startTarget = this.mainControls.target.clone();
        const startTime = performance.now();

        // Calculate up vector to avoid camera roll
        const upVector = new THREE.Vector3(0, 1, 0);
        // For top/bottom views, use a different up vector
        if (Math.abs(normalizedDirection.y) > 0.99) {
            upVector.set(0, 0, normalizedDirection.y > 0 ? -1 : 1);
        }

        // Animation loop
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / this.options.animationDuration, 1);

            // Use easing function for smooth animation
            const ease = this.easeInOutCubic(progress);

            // Interpolate camera position
            this.mainCamera.position.lerpVectors(startPosition, newCameraPosition, ease);

            // Keep target at model center
            this.mainControls.target.lerpVectors(startTarget, this.modelCenter, ease);

            // Set camera up vector to prevent roll
            this.mainCamera.up.lerp(upVector, ease * 0.1); // Gradual up vector change

            // Update camera and controls
            this.mainCamera.lookAt(this.mainControls.target);
            this.mainControls.update();

            // Update ViewCube orientation
            this.updateCubeOrientation();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete
                this.isTransitioning = false;

                // Ensure final position is exact
                this.mainCamera.position.copy(newCameraPosition);
                this.mainControls.target.copy(this.modelCenter);
                this.mainCamera.up.copy(upVector);
                this.mainCamera.lookAt(this.modelCenter);
                this.mainControls.update();

                // Update ViewCube one final time
                this.updateCubeOrientation();
            }
        };

        animate();
    }

    private easeInOutCubic(t: number): number {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    private onMouseDown(event: MouseEvent): void {
        // Track mouse down for drag detection only
        this.hasMouseMoved = false;

        // Store initial mouse position
        this.dragStartPosition.set(event.clientX, event.clientY);
        this.dragCurrentPosition.copy(this.dragStartPosition);

        // Set up document-level mouse event handlers for drag detection
        this.setupDocumentDragHandlers(event);
    }

    private updateModelCenter(): void {
        // Try to get model center from IFCViewer
        if (this.ifcViewer && this.ifcViewer.getModels) {
            const models = this.ifcViewer.getModels();
            if (models.size > 0) {
                let combinedBox = new THREE.Box3();
                let hasModels = false;

                for (const [, model] of models) {
                    const modelBox = new THREE.Box3().setFromObject(model);
                    if (!hasModels) {
                        combinedBox.copy(modelBox);
                        hasModels = true;
                    } else {
                        combinedBox.union(modelBox);
                    }
                }

                if (hasModels) {
                    combinedBox.getCenter(this.modelCenter);

                }
            }
        }

        // Fallback to world origin if no models
        if (this.modelCenter.length() === 0) {
            this.modelCenter.set(0, 0, 0);
        }
    }

    private onDragMove(event: MouseEvent): void {
        if (!this.isDragging) return;

        // Update current position
        this.dragCurrentPosition.set(event.clientX, event.clientY);

        // Calculate drag deltas
        const deltaX = this.dragCurrentPosition.x - this.dragStartPosition.x;
        const deltaY = this.dragCurrentPosition.y - this.dragStartPosition.y;

        // Store drag deltas for free rotation (both horizontal and vertical)
        this.dragDeltaX = deltaX;
        this.dragDeltaY = deltaY;

        // Rotation will be applied in the render loop for smooth interpolation


    }

    private applySmoothedRotation(): void {
        // Handle different rotation modes
        if (this.isDragging) {
            // Free 3D rotation for drag
            this.applyFreeRotation();
        } else if (this.wasJustDragging) {
            // Don't apply any rotation immediately after drag ends to prevent glitches
            // Wait for the wasJustDragging flag to be cleared
        } else {
            // Only apply constrained rotation if there's an actual target rotation (from arrow buttons)
            // Don't apply any rotation when drag ends - camera should stay where drag left it
            const hasPendingRotation = Math.abs(this.currentRotationAngle - this.targetRotationAngle) >= 0.001;
            if (hasPendingRotation) {
                this.applyConstrainedRotation();
            }
        }
    }



    private applyFreeRotation(): void {
        // Calculate rotation angles from drag deltas
        const yawAngle = -this.dragDeltaX * this.dragSensitivity * 0.01; // Horizontal rotation
        const pitchAngle = -this.dragDeltaY * this.dragSensitivity * 0.01; // Vertical rotation (inverted)



        // Apply the rotation
        this.applyRotationAngles(yawAngle, pitchAngle);
    }

    private applyRotationAngles(yawAngle: number, pitchAngle: number): void {

        // Update model center
        this.updateModelCenter();

        // Create combined rotation quaternion (pitch + yaw)
        const yawQuaternion = new THREE.Quaternion();
        yawQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);

        const pitchQuaternion = new THREE.Quaternion();
        pitchQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchAngle);

        // Combine rotations (yaw first, then pitch)
        const combinedRotation = new THREE.Quaternion();
        combinedRotation.multiplyQuaternions(yawQuaternion, pitchQuaternion);

        // Calculate camera offset from model center at start of drag
        const initialCameraOffset = new THREE.Vector3()
            .subVectors(this.initialCameraPosition, this.modelCenter);

        // Apply rotation to the initial offset
        const rotatedOffset = initialCameraOffset.clone();
        rotatedOffset.applyQuaternion(combinedRotation);

        // Set new camera position
        this.mainCamera.position.copy(this.modelCenter).add(rotatedOffset);
        this.mainCamera.updateMatrixWorld();

        // Calculate target offset from model center at start of drag
        const initialTargetOffset = new THREE.Vector3()
            .subVectors(this.initialCameraTarget, this.modelCenter);

        // Apply same rotation to target offset
        const rotatedTargetOffset = initialTargetOffset.clone();
        rotatedTargetOffset.applyQuaternion(combinedRotation);

        // Set new target position
        this.mainControls.target.copy(this.modelCenter).add(rotatedTargetOffset);

        // Update controls
        this.mainControls.update();

        // Update view cube orientation
        this.updateCubeOrientation();



    }

    private applyConstrainedRotation(): void {
        // Only apply rotation if there's significant angle difference
        if (Math.abs(this.currentRotationAngle - this.targetRotationAngle) < 0.001) {
            return; // No rotation needed
        }

        // Smoothly interpolate towards target rotation
        const angleDiff = this.targetRotationAngle - this.currentRotationAngle;
        this.currentRotationAngle += angleDiff * this.rotationSmoothing;

        // Update model center
        this.updateModelCenter();

        // Create rotation quaternion for Y-axis only (constrained)
        const rotationQuaternion = new THREE.Quaternion();
        rotationQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.currentRotationAngle);

        // Calculate camera offset from model center at start of drag
        const initialCameraOffset = new THREE.Vector3()
            .subVectors(this.initialCameraPosition, this.modelCenter);

        // Apply rotation to the initial offset
        const rotatedOffset = initialCameraOffset.clone();
        rotatedOffset.applyQuaternion(rotationQuaternion);

        // Set new camera position
        this.mainCamera.position.copy(this.modelCenter).add(rotatedOffset);
        this.mainCamera.updateMatrixWorld();

        // Calculate target offset from model center at start of drag
        const initialTargetOffset = new THREE.Vector3()
            .subVectors(this.initialCameraTarget, this.modelCenter);

        // Apply same rotation to target offset
        const rotatedTargetOffset = initialTargetOffset.clone();
        rotatedTargetOffset.applyQuaternion(rotationQuaternion);

        // Set new target position
        this.mainControls.target.copy(this.modelCenter).add(rotatedTargetOffset);

        // Update controls
        this.mainControls.update();

        // Update view cube orientation
        this.updateCubeOrientation();


    }

    private rotateLeft(): void {

        this.performDiscreteRotation(Math.PI / 8); // 22.5 degrees
    }

    private rotateRight(): void {

        this.performDiscreteRotation(-Math.PI / 8); // -22.5 degrees
    }

    private performDiscreteRotation(angleDelta: number): void {
        // Store initial camera state if not already dragging
        if (!this.isDragging) {
            this.initialCameraPosition.copy(this.mainCamera.position);
            this.initialCameraTarget.copy(this.mainControls.target);
            this.currentRotationAngle = 0;
            this.updateModelCenter();
        }

        // Apply discrete rotation immediately
        const rotationQuaternion = new THREE.Quaternion();
        rotationQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleDelta);

        // Calculate camera offset from model center
        const cameraOffset = new THREE.Vector3()
            .subVectors(this.mainCamera.position, this.modelCenter);

        // Apply rotation to the offset
        cameraOffset.applyQuaternion(rotationQuaternion);

        // Set new camera position
        this.mainCamera.position.copy(this.modelCenter).add(cameraOffset);
        this.mainCamera.updateMatrixWorld();

        // Calculate target offset from model center
        const targetOffset = new THREE.Vector3()
            .subVectors(this.mainControls.target, this.modelCenter);

        // Apply same rotation to target offset
        targetOffset.applyQuaternion(rotationQuaternion);

        // Set new target position
        this.mainControls.target.copy(this.modelCenter).add(targetOffset);

        // Update controls
        this.mainControls.update();

        // Update view cube orientation
        this.updateCubeOrientation();


    }

    private setupDocumentDragHandlers(_event: MouseEvent): void {
        // Remove any existing handlers
        this.cleanupDocumentDragHandlers();

        // Create document-level mouse move handler
        this.documentMouseMoveHandler = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Check if mouse has moved enough to be considered a drag
            const deltaX = Math.abs(e.clientX - this.dragStartPosition.x);
            const deltaY = Math.abs(e.clientY - this.dragStartPosition.y);
            const hasMovedEnough = deltaX > this.dragThreshold || deltaY > this.dragThreshold;

            if (!this.hasMouseMoved && hasMovedEnough) {
                // First significant movement - start the drag operation
                this.hasMouseMoved = true;
                this.isDragging = true;
                console.log('[ViewCube] DRAG START - Camera pos:', this.mainCamera.position, 'Target:', this.mainControls.target);

                // Store current camera state for smooth rotation
                this.initialCameraPosition.copy(this.mainCamera.position);
                this.initialCameraTarget.copy(this.mainControls.target);

                // Reset drag deltas for this new drag session
                this.dragDeltaX = 0;
                this.dragDeltaY = 0;

                // Update model center for drag operation
                this.updateModelCenter();

                // Change cursor to indicate dragging
                const canvas = this.renderer.domElement;
                canvas.style.cursor = 'grabbing';
            }

            // Check if mouse is within drag tolerance area (only if dragging)
            if (this.isDragging) {
                const canvas = this.renderer.domElement;
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX;
                const mouseY = e.clientY;

                // Check if mouse is within tolerance distance of the cube
                const distanceFromCube = this.getDistanceFromCube(mouseX, mouseY, rect);
                if (distanceFromCube <= this.dragTolerance) {
                    // Mouse is within tolerance, continue drag
                    this.onDragMove(e);
                } else {
                    // Mouse is too far, end drag
                    console.log('[ViewCube] DRAG END - Mouse left tolerance area');
                    this.cleanupDocumentDragHandlers();
                    this.endDrag();
                }
            }
        };

        // Create document-level mouse up handler
        this.documentMouseUpHandler = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (this.isDragging) {
                // This was a drag - end the drag operation
                this.cleanupDocumentDragHandlers();
                this.endDrag();
            } else {
                // Mouse moved but not enough to be a drag
                // Just clean up
                this.cleanupDocumentDragHandlers();
                this.resetMouseState();
            }
        };

        // Add document-level event listeners
        document.addEventListener('mousemove', this.documentMouseMoveHandler, true);
        document.addEventListener('mouseup', this.documentMouseUpHandler, true);
    }

    private cleanupDocumentDragHandlers(): void {
        if (this.documentMouseMoveHandler) {
            document.removeEventListener('mousemove', this.documentMouseMoveHandler, true);
            this.documentMouseMoveHandler = null;
        }
        if (this.documentMouseUpHandler) {
            document.removeEventListener('mouseup', this.documentMouseUpHandler, true);
            this.documentMouseUpHandler = null;
        }
    }

    private getDistanceFromCube(mouseX: number, mouseY: number, cubeRect: DOMRect): number {
        // Calculate distance from mouse to closest edge of cube
        const left = cubeRect.left;
        const right = cubeRect.right;
        const top = cubeRect.top;
        const bottom = cubeRect.bottom;

        // Check if mouse is inside cube
        if (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom) {
            return 0; // Inside cube
        }

        // Calculate distance to closest edge
        let distanceX = 0;
        let distanceY = 0;

        if (mouseX < left) distanceX = left - mouseX;
        else if (mouseX > right) distanceX = mouseX - right;

        if (mouseY < top) distanceY = top - mouseY;
        else if (mouseY > bottom) distanceY = mouseY - bottom;

        // Return Euclidean distance to closest corner or edge
        return Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    }



    private resetMouseState(): void {
        this.hasMouseMoved = false;
        this.isDragging = false;

        // Reset cursor
        const canvas = this.renderer.domElement;
        canvas.style.cursor = 'grab';
    }

    private endDrag(): void {
        this.onMouseUp(new MouseEvent('mouseup'));
    }

    private onMouseUp(_event: MouseEvent): void {
        if (this.isDragging) {
            console.log('[ViewCube] DRAG END - Camera pos:', this.mainCamera.position, 'Target:', this.mainControls.target);

            // Clean up document-level drag handlers
            this.cleanupDocumentDragHandlers();

            // Reset drag deltas to stop rotation immediately
            this.dragDeltaX = 0;
            this.dragDeltaY = 0;

            this.isDragging = false;

            // Mark that we just finished dragging to prevent accidental clicks
            this.wasJustDragging = true;

            // Clear the "just dragging" flag after a short delay
            setTimeout(() => {
                this.wasJustDragging = false;
            }, 150); // 150ms delay to prevent accidental clicks

            // Reset cursor
            const canvas = this.renderer.domElement;
            canvas.style.cursor = 'grab';

            // Reset mouse state
            this.resetMouseState();

            // Ensure camera and controls are properly synchronized after drag
            this.mainCamera.updateMatrixWorld();
            this.mainControls.update();
        }
    }



















    public updateCubeOrientation(): void {
        if (!this.cube || !this.mainCubeMesh) return;

        // Create a quaternion that represents the inverse of the main camera's orientation
        const quaternion = this.mainCamera.quaternion.clone();
        this.cube.setRotationFromQuaternion(quaternion.invert());
    }

    private render(): void {
        // Apply smoothed rotation for drag
        if (this.isDragging) {

        }
        this.applySmoothedRotation();

        // Always render to ensure visibility
        if (!this.isAnimating && !this.isDragging && this.cube && this.mainCubeMesh) {
            // Add subtle continuous rotation for life (only when not dragging)
            this.cube.rotation.x += 0.001;
            this.cube.rotation.y += 0.002;

            // Add subtle floating effect
            this.cube.position.y = Math.sin(Date.now() * 0.001) * 0.01;
        }

        // Always render the scene
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        } else {
            console.warn('[ViewCube] Missing renderer, scene, or camera for rendering');
        }

        requestAnimationFrame(() => this.render());
    }

    public dispose(): void {
        // Clean up document-level drag handlers
        this.cleanupDocumentDragHandlers();

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.renderer.domElement && this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }

        if (this.zoomControlsContainer && this.zoomControlsContainer.parentNode) {
            this.zoomControlsContainer.parentNode.removeChild(this.zoomControlsContainer);
        }

        if (this.arrowControlsContainer && this.arrowControlsContainer.parentNode) {
            this.arrowControlsContainer.parentNode.removeChild(this.arrowControlsContainer);
        }

        this.renderer.dispose();
    }

    // Debug method to check ViewCube status
    public debugStatus(): void {
        console.log('[ViewCube] STATUS - Dragging:', this.isDragging);
        console.log('[ViewCube] Camera pos:', this.mainCamera.position, 'Target:', this.mainControls.target);
    }

    public setSize(width: number, height: number): void {
        this.renderer.setSize(width, height);
    }

    public setPosition(x: number, y: number): void {
        this.renderer.domElement.style.top = `${y}px`;
        this.renderer.domElement.style.right = `${x}px`;
    }

    // Public method to update model center when models change
    public updateModelCenterFromViewer(): void {
        this.updateModelCenter();
    }
}
