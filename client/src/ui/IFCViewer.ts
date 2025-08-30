import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { IfcAPI } from "web-ifc";
import { Picker } from "./components/Picker";
import { GeometryData, IFCModel, PlacedGeometry } from "./types";

export class IFCViewer {
    private container: HTMLElement;
    private loadingOverlay: HTMLElement | null;
    private models: Map<number, IFCModel>;
    private modelCounter: number;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private ifcAPI: IfcAPI;
    private grid: THREE.GridHelper;
    private axes: THREE.AxesHelper;
    private picker: Picker;
    private meshCounter: number;
    private sectionBoxHelper: THREE.LineSegments | null;
    private isConnectionMode: boolean = false;
    private pdfImagePaths: string[];
    private pdfPreviewWindow: HTMLDivElement;
    private lastHoveredModel: IFCModel | null = null;

    // Clash isolation state
    private guidIndex: Map<string, THREE.Object3D[]> = new Map();
    private lastIsolatedGuids: Set<string> = new Set();
    private isWasmInitialized: boolean = false;
    private currentZoomAnimation: number | null = null;
    private initialCameraPosition: THREE.Vector3 | null = null;
    private initialCameraTarget: THREE.Vector3 | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.loadingOverlay = null;
        this.models = new Map();
        this.modelCounter = 0;
        this.meshCounter = 0;
        this.sectionBoxHelper = null;

        // Initialize Three.js components
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
        });
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Initialize IFC API
        this.ifcAPI = new IfcAPI();

        // Initialize scene helpers
        this.grid = new THREE.GridHelper(50, 50);
        this.axes = new THREE.AxesHelper(5);

        // Initialize UI components
        this.picker = new Picker(this);

        // Initialize PDF preview window and PNG image paths.
        this.pdfImagePaths = ["/page_4_name_IW 3.1.png", "/page_3_name_AW 1.1.png"];
        this.pdfPreviewWindow = document.createElement("div");
        this.pdfPreviewWindow.style.position = "absolute";
        this.pdfPreviewWindow.style.background = "rgba(255, 255, 255, 0.9)";
        this.pdfPreviewWindow.style.border = "1px solid #ccc";
        this.pdfPreviewWindow.style.padding = "10px";
        this.pdfPreviewWindow.style.display = "none";
        this.pdfPreviewWindow.style.zIndex = "1000";
        this.pdfPreviewWindow.style.maxWidth = "400px";
        this.pdfPreviewWindow.style.boxShadow = "2px 2px 6px rgba(0,0,0,0.3)";
        this.container.appendChild(this.pdfPreviewWindow);

        // Start initialization
        this.init();
    }

    private showLoading(): void {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add("active");
        }
    }

    private hideLoading(): void {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove("active");
        }
    }

    private async init(): Promise<void> {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => this.setup());
        } else {
            await this.setup();
        }
    }

    private async setup(): Promise<void> {
        try {
            this.loadingOverlay = document.querySelector(".loading-overlay");
            this.showLoading();

            // Initialize scene
            this.scene.background = new THREE.Color(0xf0f0f0);

            // Setup camera
            this.camera.position.set(10, 10, 10);
            this.camera.lookAt(0, 0, 0);

            // Setup renderer
            // Use container dimensions instead of window dimensions
            const containerWidth = this.container.clientWidth || 800;
            const containerHeight = this.container.clientHeight || 600;


            this.renderer.setSize(containerWidth, containerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.shadowMap.enabled = false;
            this.container.appendChild(this.renderer.domElement);

            // Setup controls
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;

            // Setup grid and axes
            this.grid.visible = false;
            this.scene.add(this.grid);

            this.axes.visible = false;
            this.scene.add(this.axes);

            // Setup lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 10, 5);
            directionalLight.castShadow = true;
            this.scene.add(directionalLight);

            // Initialize IFC API with proper WASM path
            // Force single-threaded mode by passing true as second parameter
            this.ifcAPI.SetWasmPath('/');
            await this.ifcAPI.Init(undefined, true);
            this.isWasmInitialized = true;

            // Setup UI components
            this.setupPicking();
            this.setupKeyboardShortcuts();
            this.setupClashEventListeners();

            // Setup window resize handler
            window.addEventListener("resize", () => this.onWindowResize());

            // Start animation loop
            this.animate();


        } catch (error) {
            console.error("Error initializing IFC viewer:", error);
            if (error instanceof Error) {
                console.error("Error details:", error.stack);
            }
        } finally {
            this.hideLoading();
        }
    }

    private onWindowResize(): void {
        const containerWidth = this.container.clientWidth || 800;
        const containerHeight = this.container.clientHeight || 600;

        this.camera.aspect = containerWidth / containerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(containerWidth, containerHeight);


    }

    public resize(): void {
        this.onWindowResize();
    }

    public refreshViewer(): void {
        // Force a resize to ensure proper dimensions
        this.onWindowResize();

        // Force a render
        this.renderer.render(this.scene, this.camera);
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    public async loadIFC(file: File): Promise<void> {
        try {

            this.showLoading();

            // Ensure WASM is fully initialized before proceeding
            if (!this.isWasmInitialized) {

                await this.ifcAPI.Init(undefined, true);
                this.isWasmInitialized = true;

            }

            const data = await file.arrayBuffer();


            const modelID = this.ifcAPI.OpenModel(new Uint8Array(data), {
                COORDINATE_TO_ORIGIN: true,
            });


            const model = new THREE.Group() as IFCModel;
            model.name = file.name;
            model.modelID = modelID;
            model.userData.viewerModel = true;

            let elementCount = 0;
            let geometryCount = 0;

            this.ifcAPI.StreamAllMeshes(modelID, (mesh: any) => {
                const placedGeometries = mesh.geometries;
                const expressID = mesh.expressID;

                // Get the IFC type name
                const typeCode = this.ifcAPI.GetLineType(modelID, expressID);
                const ifcType = this.ifcAPI.GetNameFromTypeCode(typeCode);


                const elementGroup = this.createElementGroup(
                    expressID,
                    modelID,
                    ifcType
                );

                // Index GUID for clash isolation
                this.indexElementGuid(elementGroup, modelID, expressID);

                for (let i = 0; i < placedGeometries.size(); i++) {
                    const placedGeometry = placedGeometries.get(i) as PlacedGeometry;

                    try {
                        const geometry = this.getBufferGeometry(modelID, placedGeometry);
                        geometryCount++;

                        const matrix = new THREE.Matrix4();
                        matrix.fromArray(placedGeometry.flatTransformation);
                        geometry.applyMatrix4(matrix);

                        const color = placedGeometry.color;
                        const material = new THREE.MeshPhongMaterial({
                            color: new THREE.Color(color.x, color.y, color.z),
                            opacity: color.w,
                            transparent: color.w !== 1,
                            side: THREE.DoubleSide,
                        });

                        const mesh = this.createMesh(
                            geometry,
                            material,
                            expressID,
                            modelID
                        );

                        elementGroup.add(mesh);
                    } catch (error) {
                        console.error(
                            `Error processing geometry ${i} for element ${expressID}:`,
                            error
                        );
                    }
                }

                model.add(elementGroup);
                elementCount++;
            });


            this.scene.add(model);
            const modelId = ++this.modelCounter;
            this.models.set(modelId, model);

            this.createModelListItem(modelId, file.name, model);

            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());



            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

            this.camera.position.set(
                center.x + cameraZ * 0.5,
                center.y + cameraZ * 0.5,
                center.z + cameraZ
            );
            this.controls.target.copy(center);
            this.camera.lookAt(center);
            this.controls.update();


        } catch (error) {
            console.error("Error loading IFC file:", error);
            if (error instanceof Error) {
                console.error("Error details:", error.stack);
            }
        } finally {
            this.hideLoading();
        }
    }

    private indexElementGuid(elementGroup: THREE.Group, modelID: number, expressID: number): void {
        try {
            const line = this.ifcAPI.GetLine(modelID, expressID);
            const guid = this.extractGuid(line);

            if (guid) {
                elementGroup.userData.guid = guid;
                const arr = this.guidIndex.get(guid) || [];
                arr.push(elementGroup);
                this.guidIndex.set(guid, arr);

            } else {
                console.warn(`No GUID found for element ${expressID}`);
            }
        } catch (e) {
            console.warn("Could not read line for expressID", expressID, e);
        }
    }

    private extractGuid(line: any): string | null {
        // web-ifc typically exposes GlobalId as a string, but be defensive
        // Common shapes: "GlobalId": "xxxxx" OR "GlobalId": { value: "xxxxx" }
        const raw = line?.GlobalId ?? line?.GlobalID ?? line?.mGlobalId;
        if (!raw) return null;
        if (typeof raw === "string") return raw;
        if (typeof raw?.value === "string") return raw.value;
        return null;
    }

    private getBufferGeometry(
        modelID: number,
        placedGeometry: PlacedGeometry
    ): THREE.BufferGeometry {
        const geometry = this.ifcAPI.GetGeometry(
            modelID,
            placedGeometry.geometryExpressID
        ) as GeometryData;

        const verts = this.ifcAPI.GetVertexArray(
            geometry.GetVertexData(),
            geometry.GetVertexDataSize()
        );
        const indices = this.ifcAPI.GetIndexArray(
            geometry.GetIndexData(),
            geometry.GetIndexDataSize()
        );

        const bufferGeometry = new THREE.BufferGeometry();
        const posFloats = new Float32Array(verts.length / 2);
        const normFloats = new Float32Array(verts.length / 2);

        for (let i = 0; i < verts.length; i += 6) {
            posFloats[i / 2] = verts[i];
            posFloats[i / 2 + 1] = verts[i + 1];
            posFloats[i / 2 + 2] = verts[i + 2];

            normFloats[i / 2] = verts[i + 3];
            normFloats[i / 2 + 1] = verts[i + 4];
            normFloats[i / 2 + 2] = verts[i + 5];
        }

        bufferGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(posFloats, 3)
        );
        bufferGeometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(normFloats, 3)
        );
        bufferGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

        geometry.delete();
        return bufferGeometry;
    }

    private setupKeyboardShortcuts(): void {
        document.addEventListener("keydown", (event: KeyboardEvent) => {
            if (
                event.code === "Space" &&
                this.picker.selectedObject &&
                !(event.target as HTMLElement).closest("input, textarea")
            ) {
                event.preventDefault();
                this.toggleSelectedVisibility();
            }
        });
    }

    public toggleSelectedVisibility(): void {
        if (!this.picker.selectedObject) return;

        const isVisible = this.picker.selectedObject.visible;
        this.picker.selectedObject.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
                child.visible = !isVisible;
            }
        });
    }

    public isolateSelected(): void {
        if (!this.picker.selectedObject) return;

        this.models.forEach((model) => {
            model.traverse((child: THREE.Object3D) => {
                if ((child as THREE.Mesh).isMesh) {
                    child.visible = false;
                }
            });
        });

        this.picker.selectedObject.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
                child.visible = true;
            }
        });
    }

    public showAll(): void {
        this.models.forEach((model) => {
            model.traverse((child: THREE.Object3D) => {
                if ((child as THREE.Mesh).isMesh) {
                    child.visible = true;
                }
            });
        });
    }

    private setupPicking(): void {
        this.container.addEventListener("click", (event: MouseEvent) => {
            this.handleClick(event);
        });

        this.container.addEventListener("mousemove", (event: MouseEvent) => {
            this.handleMouseMove(event);
        });
    }

    private createModelListItem(
        modelId: number,
        fileName: string,
        model: IFCModel
    ): void {
        const modelsList = document.getElementById("models-list");
        if (!modelsList) return;

        const modelItem = document.createElement("div");
        modelItem.className = "model-item";
        modelItem.id = `model-${modelId}`;

        const modelHeader = document.createElement("div");
        modelHeader.className = "model-header";

        const modelName = document.createElement("div");
        modelName.className = "model-name";
        modelName.textContent = fileName;

        const modelControls = document.createElement("div");
        modelControls.className = "model-controls";

        // Visibility toggle button
        const visibilityBtn = document.createElement("button");
        visibilityBtn.className = "model-control-btn";
        visibilityBtn.innerHTML = '<i class="fas fa-eye"></i>';
        visibilityBtn.title = "Toggle Visibility";
        visibilityBtn.addEventListener("click", () => {
            model.visible = !model.visible;
            visibilityBtn.innerHTML = model.visible
                ? '<i class="fas fa-eye"></i>'
                : '<i class="fas fa-eye-slash"></i>';
        });

        // PDF Upload button
        const pdfUploadBtn = document.createElement("button");
        pdfUploadBtn.className = "model-control-btn";
        pdfUploadBtn.innerHTML = '<i class="fas fa-file-pdf"></i>';
        pdfUploadBtn.title = "Upload PDF";
        pdfUploadBtn.addEventListener("click", () => {
            pdfInput.click();
        });

        // Hidden PDF input for uploading PDFs
        const pdfInput = document.createElement("input");
        pdfInput.type = "file";
        pdfInput.accept = "application/pdf";
        pdfInput.style.display = "none";
        pdfInput.addEventListener("change", (event: Event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (file) {

                // Mark this model as having a PDF loaded and store a single random preview image.
                model.userData.hasPDF = true;
                model.userData.pdfPreviewImage = this.getRandomPdfImage();

                // PDF upload confirmation message with enhanced styling
                let confirmation = modelItem.querySelector(".pdf-upload-confirmation");
                if (!confirmation) {
                    confirmation = document.createElement("div");
                    confirmation.className = "pdf-upload-confirmation";
                    // Styling similar to the model tree / app alerts
                    (confirmation as HTMLElement).style.marginTop = "5px";
                    (confirmation as HTMLElement).style.fontSize = "14px";
                    (confirmation as HTMLElement).style.color = "#155724";
                    (confirmation as HTMLElement).style.backgroundColor = "#d4edda";
                    (confirmation as HTMLElement).style.border = "1px solid #c3e6cb";
                    (confirmation as HTMLElement).style.borderRadius = "4px";
                    (confirmation as HTMLElement).style.padding = "4px 8px";
                    (confirmation as HTMLElement).style.maxWidth = "80%";
                    (confirmation as HTMLElement).style.margin = "5px auto";
                    modelItem.appendChild(confirmation);
                }
                confirmation.textContent = `PDF uploaded successfully: ${file.name}`;

                // Handle the PDF file as needed (e.g., store or display it)
            }
        });

        // Delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "model-control-btn";
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = "Delete Model";
        deleteBtn.addEventListener("click", async () => {
            this.scene.remove(model);
            this.models.delete(modelId);
            modelItem.remove();
        });

        // Append the buttons to the controls container
        modelControls.appendChild(visibilityBtn);
        modelControls.appendChild(pdfUploadBtn);
        modelControls.appendChild(deleteBtn);
        modelHeader.appendChild(modelName);
        modelHeader.appendChild(modelControls);
        modelItem.appendChild(modelHeader);
        // Append the hidden PDF input to the model card
        modelItem.appendChild(pdfInput);

        // Model info section
        const modelInfo = document.createElement("div");
        modelInfo.className = "model-info";

        // Get model information
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        modelInfo.innerHTML = `
      <div>Size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(
            2
        )}</div>
      <div>Center: (${center.x.toFixed(2)}, ${center.y.toFixed(
            2
        )}, ${center.z.toFixed(2)})</div>
    `;

        // Add spatial tree section to model card
        const treeSection = document.createElement("div");
        treeSection.className = "model-tree-section";
        const treeContent = document.createElement("div");
        treeContent.className = "model-tree-content";
        treeContent.id = `model-tree-${modelId}`;
        treeSection.appendChild(treeContent);

        modelItem.appendChild(modelInfo);
        modelItem.appendChild(treeSection);
        modelsList.appendChild(modelItem);
    }



    private setupClashEventListeners(): void {
        document.addEventListener("clash-selection-change", (e: any) => {
            const guids: string[] = e?.detail?.guids ?? [];
            if (guids.length > 0) {
                this.isolateByGuids(guids, { zoom: true });
            } else {
                this.clearClashIsolation();
            }
        });
    }

    private createElementGroup(
        expressID: number,
        modelID: number,
        ifcType: string
    ): THREE.Group {
        const elementGroup = new THREE.Group();
        elementGroup.name = `Element_${expressID}`;
        elementGroup.userData = {
            modelID,
            expressID,
            type: "element",
            ifcType,
        };
        return elementGroup;
    }

    private createMesh(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        expressID: number,
        modelID: number
    ): THREE.Mesh {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `Mesh_${expressID}_${this.meshCounter++}`;
        mesh.userData = {
            modelID,
            expressID,
            type: "mesh",
        };
        return mesh;
    }

    // Add these getter methods to the IFCViewer class
    public getModels(): Map<number, IFCModel> {
        return this.models;
    }

    public getCamera(): THREE.Camera {
        return this.camera;
    }

    public getControls(): any {
        return this.controls;
    }

    public getScene(): THREE.Scene {
        return this.scene;
    }

    public getIfcAPI(): IfcAPI {
        return this.ifcAPI;
    }



    public setSectionBox(bbox: THREE.Box3 | null): void {
        // Remove existing section box if bbox is null
        if (!bbox) {
            if (this.sectionBoxHelper) {
                this.scene.remove(this.sectionBoxHelper);
                this.sectionBoxHelper = null;
            }
            // Reset clipping planes
            this.renderer.clippingPlanes = [];
            this.renderer.localClippingEnabled = false;
            return;
        }

        // Remove existing helper
        if (this.sectionBoxHelper) {
            this.scene.remove(this.sectionBoxHelper);
        }

        // Create custom material for dotted lines
        const material = new THREE.LineDashedMaterial({
            color: 0x000000, // Black color
            dashSize: 0.2, // Length of the dashes
            gapSize: 0.1, // Length of the gaps
            linewidth: 1,
            scale: 1, // Scale of the dashes
        });

        // Create box geometry
        const geometry = new THREE.BoxGeometry(
            bbox.max.x - bbox.min.x,
            bbox.max.y - bbox.min.y,
            bbox.max.z - bbox.min.z
        );
        const edges = new THREE.EdgesGeometry(geometry);

        this.sectionBoxHelper = new THREE.LineSegments(edges, material);

        // Position the box at center of bounds
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        this.sectionBoxHelper.position.copy(center);

        // Compute line distances (required for dashed lines)
        this.sectionBoxHelper.computeLineDistances();

        this.scene.add(this.sectionBoxHelper);

        // Update clipping planes
        const planes = [
            new THREE.Plane(new THREE.Vector3(-1, 0, 0), bbox.max.x),
            new THREE.Plane(new THREE.Vector3(1, 0, 0), -bbox.min.x),
            new THREE.Plane(new THREE.Vector3(0, -1, 0), bbox.max.y),
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -bbox.min.y),
            new THREE.Plane(new THREE.Vector3(0, 0, -1), bbox.max.z),
            new THREE.Plane(new THREE.Vector3(0, 0, 1), -bbox.min.z),
        ];

        this.renderer.clippingPlanes = planes;
        this.renderer.localClippingEnabled = true;

        // Zoom to fit section box
        this.zoomToBox(bbox);
    }

    private zoomToBox(bbox: THREE.Box3): void {
        // Cancel any ongoing zoom animation
        if (this.currentZoomAnimation !== null) {
            cancelAnimationFrame(this.currentZoomAnimation);
            this.currentZoomAnimation = null;
        }

        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        bbox.getCenter(center);
        bbox.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);

        // Calculate optimal distance for tight framing
        const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.1; // 10% padding
        const clampedDistance = Math.max(2, Math.min(distance, 30));

        // Simple camera positioning for bounding box
        const newPosition = new THREE.Vector3();

        // Classic 3/4 view that's well centered
        const angle = Math.PI / 4; // 45 degrees
        newPosition.set(
            center.x + Math.cos(angle) * clampedDistance * 0.7,  // Diagonal offset
            center.y + clampedDistance * 0.8,                     // Above
            center.z + Math.sin(angle) * clampedDistance * 0.7   // Diagonal offset
        );

        // Animate camera movement
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const startTime = performance.now();
        const duration = 800; // Consistent with clash point zoom duration

        const animate = (currentTime: number): void => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth ease-in-out using sine
            const ease = 0.5 - 0.5 * Math.cos(progress * Math.PI);

            // Update camera position and target with lerp
            this.camera.position.lerpVectors(startPos, newPosition, ease);
            this.controls.target.lerpVectors(startTarget, center, ease);

            // Ensure camera looks at target
            this.camera.lookAt(this.controls.target);
            this.controls.update();

            // Continue animation if not complete
            if (progress < 1) {
                this.currentZoomAnimation = requestAnimationFrame(animate);
            } else {
                // Final positioning - ensure exact centering
                this.camera.position.copy(newPosition);
                this.controls.target.copy(center);
                this.camera.lookAt(center);
                this.controls.update();
                this.currentZoomAnimation = null;
            }
        };

        this.currentZoomAnimation = requestAnimationFrame(animate);
    }

    private zoomToClashPoints(clashPoints: [number, number, number][], targets: THREE.Object3D[]): void {
        // Cancel any ongoing animation
        if (this.currentZoomAnimation !== null) {
            cancelAnimationFrame(this.currentZoomAnimation);
            this.currentZoomAnimation = null;
        }

        // If only one clash point, use the single point zoom
        if (clashPoints.length === 1) {
            this.zoomToClashPoint(clashPoints[0], targets);
            return;
        }

        // Create a bounding box that encompasses all clash points
        const clashBounds = new THREE.Box3();
        clashPoints.forEach(point => {
            const p = new THREE.Vector3(point[0], point[1], point[2]);
            clashBounds.expandByPoint(p);
        });

        // Add some padding around the clash points
        const padding = 1.0; // 1 unit padding
        clashBounds.min.sub(new THREE.Vector3(padding, padding, padding));
        clashBounds.max.add(new THREE.Vector3(padding, padding, padding));

        // Also consider the objects' bounding box
        let objectBounds = new THREE.Box3();
        let hasObjectBounds = false;

        for (const obj of targets) {
            const objBox = new THREE.Box3().setFromObject(obj);
            if (!objBox.isEmpty()) {
                if (!hasObjectBounds) {
                    objectBounds = objBox.clone();
                    hasObjectBounds = true;
                } else {
                    objectBounds.union(objBox);
                }
            }
        }

        // Use the union of clash points box and objects box
        let finalBox = clashBounds.clone();
        if (hasObjectBounds) {
            // Only expand if the object bounds are reasonably close to clash points
            const clashCenter = new THREE.Vector3();
            const objectCenter = new THREE.Vector3();
            clashBounds.getCenter(clashCenter);
            objectBounds.getCenter(objectCenter);

            const distance = clashCenter.distanceTo(objectCenter);
            const clashSize = new THREE.Vector3();
            clashBounds.getSize(clashSize);
            const maxClashDim = Math.max(clashSize.x, clashSize.y, clashSize.z);

            // If objects are within reasonable distance, include them
            if (distance < maxClashDim * 3) {
                finalBox.union(objectBounds);
            }
        }

        // Calculate center and size
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        finalBox.getCenter(center);
        finalBox.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);

        // Calculate distance to fit all clash points with proper field of view
        const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.4; // 40% extra for comfort
        const clampedDistance = Math.max(5, Math.min(distance, 50)); // Reasonable bounds

        // Simple camera positioning for multiple clash points
        const newPosition = new THREE.Vector3();

        // Use a centered isometric view for multiple clashes
        const angle = Math.PI / 4; // 45 degrees for balanced view
        newPosition.set(
            center.x + Math.cos(angle) * clampedDistance * 0.6,  // Diagonal offset
            center.y + clampedDistance * 0.9,                     // Higher for overview
            center.z + Math.sin(angle) * clampedDistance * 0.6   // Diagonal offset
        );

        // Animate to new position
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const startTime = performance.now();
        const duration = 800;

        const animate = (currentTime: number): void => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth ease-in-out using sine for natural motion
            const ease = 0.5 - 0.5 * Math.cos(progress * Math.PI);

            // Interpolate position and target using lerp
            this.camera.position.lerpVectors(startPos, newPosition, ease);
            this.controls.target.lerpVectors(startTarget, center, ease);

            // Ensure camera looks at the interpolated target
            this.camera.lookAt(this.controls.target);
            this.controls.update();

            if (progress < 1) {
                this.currentZoomAnimation = requestAnimationFrame(animate);
            } else {
                // Final positioning - ensure exact centering on the calculated center
                this.camera.position.copy(newPosition);
                this.controls.target.copy(center);
                this.camera.lookAt(center);
                this.controls.update();

                this.currentZoomAnimation = null;
            }
        };

        this.currentZoomAnimation = requestAnimationFrame(animate);
    }

    private zoomToClashPoint(clashPoint: [number, number, number], targets: THREE.Object3D[]): void {
        // Cancel any ongoing animation
        if (this.currentZoomAnimation !== null) {
            cancelAnimationFrame(this.currentZoomAnimation);
            this.currentZoomAnimation = null;
        }

        const focusPoint = new THREE.Vector3(clashPoint[0], clashPoint[1], clashPoint[2]);

        // Calculate optimal viewing distance based on the clash context
        // Get bounding box of the target objects to understand the scale
        let contextBox = new THREE.Box3();
        let hasBox = false;

        for (const obj of targets) {
            const objBox = new THREE.Box3().setFromObject(obj);
            if (!objBox.isEmpty()) {
                if (!hasBox) {
                    contextBox = objBox.clone();
                    hasBox = true;
                } else {
                    contextBox.union(objBox);
                }
            }
        }

        // If we couldn't get a box from objects, create a minimal context around the clash point
        if (!hasBox) {
            const contextSize = 2;
            contextBox = new THREE.Box3(
                new THREE.Vector3(focusPoint.x - contextSize, focusPoint.y - contextSize, focusPoint.z - contextSize),
                new THREE.Vector3(focusPoint.x + contextSize, focusPoint.y + contextSize, focusPoint.z + contextSize)
            );
        }

        // Calculate optimal distance based on the context size
        const size = new THREE.Vector3();
        contextBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        // Calculate distance to fit the context in view with some padding
        const fov = this.camera.fov * (Math.PI / 180);
        const optimalDistance = (maxDim / 2) / Math.tan(fov / 2) * 1.5; // 1.5x for padding
        const clampedDistance = Math.max(3, Math.min(optimalDistance, 20)); // Clamp between 3 and 20 units

        // Simple, direct camera positioning for better centering
        // Position camera at a consistent angle that keeps clash centered
        const newPosition = new THREE.Vector3();

        // Use a classic isometric-like view that's centered
        // This avoids any rightward bias
        const angle = Math.PI / 4; // 45 degrees
        newPosition.set(
            focusPoint.x + Math.cos(angle) * clampedDistance * 0.7,  // Diagonal offset
            focusPoint.y + clampedDistance * 0.8,                     // Above
            focusPoint.z + Math.sin(angle) * clampedDistance * 0.7   // Diagonal offset
        );

        // Smooth animation using lerp as recommended
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const startTime = performance.now();
        const duration = 600; // Slightly faster for more responsive feel

        const animate = (currentTime: number): void => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth ease-in-out using sine for more natural motion
            const ease = 0.5 - 0.5 * Math.cos(progress * Math.PI);

            // Use lerp for smooth interpolation
            this.camera.position.lerpVectors(startPos, newPosition, ease);
            this.controls.target.lerpVectors(startTarget, focusPoint, ease);

            // Ensure camera always looks at the interpolated target
            this.camera.lookAt(this.controls.target);
            this.controls.update();

            if (progress < 1) {
                this.currentZoomAnimation = requestAnimationFrame(animate);
            } else {
                // Final positioning - ensure EXACT centering
                this.camera.position.copy(newPosition);
                this.controls.target.copy(focusPoint);
                this.camera.lookAt(focusPoint);
                this.controls.update();

                this.currentZoomAnimation = null;
            }
        };

        this.currentZoomAnimation = requestAnimationFrame(animate);
    }



    public getContainer(): HTMLElement {
        return this.container;
    }

    // Add method to toggle connection mode
    public setConnectionMode(active: boolean): void {
        this.isConnectionMode = active;
        this.picker.setConnectionMode(active);

        if (active) {
            this.clearSelection();
            this.traverse((object: THREE.Object3D) => {
                if ((object as THREE.Mesh).isMesh) {
                    const material = (object as THREE.Mesh)
                        .material as THREE.MeshPhongMaterial;
                    if (material) {
                        material.transparent = true;
                        material.opacity = 0.3;
                        material.depthWrite = false;
                    }
                }
            });
        } else {
            this.traverse((object: THREE.Object3D) => {
                if ((object as THREE.Mesh).isMesh) {
                    const material = (object as THREE.Mesh)
                        .material as THREE.MeshPhongMaterial;
                    if (material) {
                        if (!object.userData.selected) {
                            material.transparent = false;
                            material.opacity = 1;
                        }
                        material.depthWrite = true;
                    }
                }
            });
        }
    }

    // Modify the handleMouseMove method
    private handleMouseMove(event: MouseEvent): void {
        if (this.isConnectionMode) return; // Skip hover effects in connection mode

        // Update mouse position
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Find intersected objects
        let intersects: THREE.Intersection[] = [];
        this.models.forEach((model) => {
            const modelIntersects = this.raycaster.intersectObject(model, true);
            intersects = intersects.concat(modelIntersects);
        });

        // Check if an object is being hovered and if its model has a PDF loaded.
        if (intersects.length > 0) {
            const intersect = intersects[0]; // take the nearest intersect
            const model = this.getModelFromObject(intersect.object);
            if (model && model.userData.hasPDF) {
                if (this.lastHoveredModel !== model) {
                    // New hover event for this model: update (cycle) the displayed image.
                    if (typeof model.userData.pdfPreviewImageIndex !== "number") {
                        model.userData.pdfPreviewImageIndex = 0;
                    } else {
                        model.userData.pdfPreviewImageIndex =
                            (model.userData.pdfPreviewImageIndex + 1) %
                            this.pdfImagePaths.length;
                    }
                    model.userData.pdfPreviewImage =
                        this.pdfImagePaths[model.userData.pdfPreviewImageIndex];
                    this.lastHoveredModel = model;
                }
                this.showPdfPreview(intersect, model);
            } else {
                this.hidePdfPreview();
                this.lastHoveredModel = null;
            }
        } else {
            this.hidePdfPreview();
            this.lastHoveredModel = null;
        }

        // Pass the event to the picker
        this.picker.handleMouseMove(event);
    }

    // Modify the handleClick method
    private handleClick(event: MouseEvent): void {
        if (this.isConnectionMode) return; // Skip selection in connection mode

        // Update mouse position
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Find intersected objects
        let intersects: THREE.Intersection[] = [];
        this.models.forEach((model) => {
            const modelIntersects = this.raycaster.intersectObject(model, true);
            intersects = intersects.concat(modelIntersects);
        });

        // Pass the event to the picker
        this.picker.handleClick(event);
    }

    public traverse(callback: (object: THREE.Object3D) => void): void {
        this.models.forEach((model) => model.traverse(callback));
    }

    public clearSelection(): void {
        this.picker.clearSelection();
    }

    // Add these getter methods
    public getGrid(): THREE.GridHelper {
        return this.grid;
    }

    public getAxes(): THREE.AxesHelper {
        return this.axes;
    }

    public getRenderer(): THREE.WebGLRenderer {
        return this.renderer;
    }

    public getModelMap(): Map<number, IFCModel> {
        return this.models;
    }

    private getRandomPdfImage(): string {
        const randomIndex = Math.floor(Math.random() * this.pdfImagePaths.length);
        return this.pdfImagePaths[randomIndex];
    }

    private getModelFromObject(object: THREE.Object3D): IFCModel | null {
        let current: THREE.Object3D | null = object;
        while (current) {
            if (current.userData && current.userData.viewerModel) {
                return current as IFCModel;
            }
            current = current.parent;
        }
        return null;
    }

    private showPdfPreview(intersect: THREE.Intersection, model: IFCModel): void {
        if (!model.userData.hasPDF) {
            this.hidePdfPreview();
            return;
        }
        let image: string;
        if (model.userData.pdfPreviewImage) {
            image = model.userData.pdfPreviewImage;
        } else {
            image = this.getRandomPdfImage();
            model.userData.pdfPreviewImage = image;
        }


        // Populate preview window content with a single PNG image.
        this.pdfPreviewWindow.innerHTML = "";
        const img = document.createElement("img");
        img.src = image;
        img.style.width = "100%";
        img.style.height = "auto";
        this.pdfPreviewWindow.appendChild(img);

        // Compute the screen coordinates of the intersect point.
        const pos = intersect.point.clone();
        pos.project(this.camera); // convert to normalized device coordinates
        const halfWidth = window.innerWidth / 2;
        const halfHeight = window.innerHeight / 2;
        const x = pos.x * halfWidth + halfWidth;
        const y = -(pos.y * halfHeight) + halfHeight;

        // Offset the preview window so it does not obscure the object.
        this.pdfPreviewWindow.style.left = `${x + 10}px`;
        this.pdfPreviewWindow.style.top = `${y - 10}px`;
        this.pdfPreviewWindow.style.display = "block";
    }

    private hidePdfPreview(): void {
        this.pdfPreviewWindow.style.display = "none";
        this.lastHoveredModel = null;
    }

    // Clash isolation methods
    public isolateByGuids(guids: string[], opts: { zoom?: boolean; focusPoints?: [number, number, number][] } = { zoom: true }): void {
        // Cancel any ongoing zoom animation when switching clashes
        if (this.currentZoomAnimation !== null) {
            cancelAnimationFrame(this.currentZoomAnimation);
            this.currentZoomAnimation = null;
        }

        // Store initial camera position before first clash selection
        if (this.lastIsolatedGuids.size === 0 && guids.length > 0) {
            this.initialCameraPosition = this.camera.position.clone();
            this.initialCameraTarget = this.controls.target.clone();
        }

        // Union of target objects from the index
        const targets: THREE.Object3D[] = [];
        const missing: string[] = [];

        const uniq = new Set(guids.filter(Boolean));
        this.lastIsolatedGuids = uniq;

        uniq.forEach((g) => {
            const arr = this.guidIndex.get(g);

            if (arr && arr.length) targets.push(...arr);
            else missing.push(g);
        });

        if (targets.length === 0) {
            console.warn("No targets found for GUIDs", Array.from(uniq));
            return;
        }

        // 1) Hide everything
        this.models.forEach((model) => {
            model.traverse((obj) => {
                if ((obj as THREE.Mesh).isMesh) obj.visible = false;
            });
        });

        // 2) Show only targets
        for (const o of targets) {
            o.traverse((obj) => {
                if ((obj as THREE.Mesh).isMesh) {
                    obj.visible = true;
                }
            });
        }

        // 3) Zoom to clash points or union box
        if (opts.zoom) {
            // Small delay to ensure visibility changes are applied
            setTimeout(() => {
                if (opts.focusPoints && opts.focusPoints.length > 0) {
                    // Focus on all clash points
                    this.zoomToClashPoints(opts.focusPoints, targets);
                } else {
                    // Fallback to bounding box zoom
                    const union = new THREE.Box3();
                    let inited = false;
                    for (const o of targets) {
                        const b = new THREE.Box3().setFromObject(o);
                        union.copy(inited ? union.union(b) : b);
                        inited = true;
                    }
                    if (inited) {
                        this.zoomToBox(union);
                    }
                }
            }, 50);
        }

        if (missing.length) {
            console.warn("Some GUIDs not found in index", missing);
        }
    }

    public clearClashIsolation(): void {
        // Cancel any ongoing zoom animation
        if (this.currentZoomAnimation !== null) {
            cancelAnimationFrame(this.currentZoomAnimation);
            this.currentZoomAnimation = null;
        }

        this.lastIsolatedGuids.clear();
        this.showAll();

        // Restore camera to initial position if we have it stored
        if (this.initialCameraPosition && this.initialCameraTarget) {
            this.animateCameraToPosition(this.initialCameraPosition, this.initialCameraTarget);

            // Clear the stored positions after restoring
            this.initialCameraPosition = null;
            this.initialCameraTarget = null;
        }
    }

    private animateCameraToPosition(targetPosition: THREE.Vector3, targetLookAt: THREE.Vector3): void {
        // Cancel any ongoing animation
        if (this.currentZoomAnimation !== null) {
            cancelAnimationFrame(this.currentZoomAnimation);
            this.currentZoomAnimation = null;
        }

        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const startTime = performance.now();
        const duration = 800;

        const animate = (currentTime: number): void => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth ease-in-out cubic
            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            // Interpolate position and target
            this.camera.position.lerpVectors(startPos, targetPosition, ease);
            this.controls.target.lerpVectors(startTarget, targetLookAt, ease);

            // Update camera and controls
            this.camera.lookAt(this.controls.target);
            this.controls.update();

            if (progress < 1) {
                this.currentZoomAnimation = requestAnimationFrame(animate);
            } else {
                // Final positioning
                this.camera.position.copy(targetPosition);
                this.controls.target.copy(targetLookAt);
                this.camera.lookAt(targetLookAt);
                this.controls.update();
                this.currentZoomAnimation = null;
            }
        };

        this.currentZoomAnimation = requestAnimationFrame(animate);
    }


}

// Note: IFCViewer is now initialized by React in App.tsx
// The automatic DOM initialization has been removed to avoid conflicts
