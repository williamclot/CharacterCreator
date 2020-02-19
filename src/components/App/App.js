import React, { Component, createRef, useState, useEffect, useMemo, useRef } from 'react'

import SettingsPopup from '../SettingsPopup'
import UploadWizard from '../UploadWizard'
import Header from '../Header';
import Selector from '../Selector';
import PartTypesView from '../PartTypes'
import LoadingIndicator from '../LoadingIndicator';
import ButtonsContainer from '../ButtonsContainer';

import mainSceneManager from '../../scenes/mainSceneManager';

import {
    ACCEPTED_OBJECT_FILE_EXTENSIONS,
    POSITION_0_0_0,
    OBJECT_STATUS
} from '../../constants'
import { fetchObjects, get3DObject, getObjectFromGeometry } from '../../util/objectHelpers';
import {
    getPartTypes, getObjects, getNameAndExtension, objectMap,
} from '../../util/helpers'
import useMmfApi from '../../hooks/useMmfApi';


import styles from './App.module.scss'

const hashSelectedPartIds = (selectedPartIds) => {
    return selectedPartIds
        .sort((p1, p2) => p2 - p1) // sort because different order should produce the same hash
        .join(':');
}

const App = props => {
    const [customizerName, setName]     = useState(props.worldData['name'] || '');
    const [price, setPrice]             = useState(props.worldData['price'] || '');
    const [description, setDescription] = useState(props.worldData['description'] || '');
    const [isPrivate, setIsPrivate]     = useState(props.worldData['is_private']);
    const [imageUrl, setImageUrl]       = useState(props.worldData['image_url'] || null);
    
    const partTypes = useMemo(() => getPartTypes(props.worldData), [props.worldData]);
    const partTypesArray = partTypes.allIds.map(id => partTypes.byId[id]);

    const [objects, setObjects] = useState(() => getObjects(props.objects));

    const [selectedPartTypeId, setSelectedPartTypeId] = useState(partTypes.allIds[ 0 ] || null);
    const [selectedParts, setSelectedParts] = useState({});
    const selectedPartsIds = Object.keys(selectedParts).map(key => selectedParts[key]);

    const [uploadedObjectData, setUploadedObjectData] = useState(null);

    const [customizedMeshes, setCustomizedMeshes] = useState(props.customizedMeshes);
    const [customizedMeshesInCart, setCustomizedMeshesInCart] = useState(props.customizedMeshesInCart);

    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const canvasContainerRef = useRef();

    const api = useMmfApi(props.api);

    useEffect(() => {
        const canvas = mainSceneManager.getCanvas();
        canvasContainerRef.current.appendChild(canvas);
        return () => canvasContainerRef.current.removeChild(canvas);
    }, []);

    useEffect(() => {
        mainSceneManager.init(partTypesArray);
    }, []);

    useEffect(() => {
        const initialRotation = props.worldData['container_rotation'];
        if(initialRotation) {
            mainSceneManager.setContainerRotation(initialRotation);
        };
    }, [props.worldData['container_rotation']]);

    useEffect(() => {
        mainSceneManager.renderScene();
    }, []);

    useEffect(() => void (async () => {
        setIsLoading(true);
    
        try {
            let oneOfEach = {};
            
            // check location hash for initial selected parts
            const hash = window.location.hash.slice(1);
            if (hash !== '') {
                /** @type {number[]} */
                const selectedIds = JSON.parse(hash);
    
                for (const partId of selectedIds) {
                    const part = objects.byId[partId];
                    if (part) {
                        oneOfEach[part.partTypeId] = part;
                    }
                }
            }
    
            // select first part from each part type that hasn't been filled out from the hash
            for (const partTypeId of partTypes.allIds) {
                if (!oneOfEach[partTypeId]) {
                    oneOfEach[partTypeId] = getObjectsByPartTypeId(partTypeId)[0]; // get first if not found in hash
                }
            }
    
    
            const objectsToLoad = await fetchObjects( oneOfEach )
            const newSelectedParts = objectMap( oneOfEach, object => object.id )
    
            
            {
                mainSceneManager.addAll(objectsToLoad);
                mainSceneManager.rescaleContainerToFitObjects();
                mainSceneManager.renderScene();
            }
    
    
            setSelectedParts(newSelectedParts);
    
        } catch ( err ) {
            console.error( err )
        }
        
        setIsLoading(false);
    })(), []);



    const meshesOwnedByUserMap = useMemo(() => {
        let selectedPartsMap = {};
        for(const customizedMeshId of props.customizedMeshesOwnedByUser) {
            const customizedMesh = customizedMeshes[customizedMeshId];
            const ownedMeshHash = hashSelectedPartIds(customizedMesh.selectedPartIds);
            selectedPartsMap[ownedMeshHash] = true;
        }
        return selectedPartsMap;
    }, [props.customizedMeshesOwnedByUser, customizedMeshes]);

    const userOwnsCurrentSelection = useMemo(() => {
        const selectedObjectsHash = hashSelectedPartIds(selectedPartsIds);
        return Boolean(meshesOwnedByUserMap[selectedObjectsHash]);
    }, [selectedPartsIds, meshesOwnedByUserMap]);

    const meshesInCartMap = useMemo(() => {
        let selectedPartsMap = {};
        for(const customizedMeshId of customizedMeshesInCart) {
            const customizedMesh = customizedMeshes[customizedMeshId];
            const meshInCartHash = hashSelectedPartIds(customizedMesh.selectedPartIds);
            selectedPartsMap[meshInCartHash] = true;
        }

        return selectedPartsMap;
    }, [customizedMeshesInCart, customizedMeshes]);

    const isSelectionInCart = useMemo(() => {
        const selectedObjectsHash = hashSelectedPartIds(selectedPartsIds);
        return Boolean(meshesInCartMap[selectedObjectsHash]);
    }, [selectedPartsIds, meshesInCartMap]);



    const showUploadWizard = Boolean(uploadedObjectData);

    const selectedPartType = partTypes.byId[selectedPartTypeId];

    const selectorData = (selectedPartType ?
        {
            objects:  getObjectsByPartTypeId(selectedPartType.id),
            currentPartType: selectedPartType
        } : null
    );
    
    function mustUserBuySelection() {
        if (!props.customizer_pay_per_download_enabled) {
            return false;
        }

        if(props.edit_mode) {
            // edit mode means user can edit, which means he is either the owner or the admin
            return false;
        }

        if(props.worldData.price > 0) {
            return !userOwnsCurrentSelection;
        }

        return false;
    }
    const userMustBuySelection = mustUserBuySelection();

    function getObject( objectId ) {
        return objects.byId[ objectId ]
    }

    function getPartType( partTypeId ) {
        return partTypes.byId[ partTypeId ]
    }

    function getSelectedObjectId( partTypeId ) {
        return selectedParts[ partTypeId ]
    }

    function getSelectedObject( partTypeId ) {
        const objectId = getSelectedObjectId( partTypeId )

        return getObject( objectId )
    }

    function getObjectsByPartTypeId( partTypeId ) {
        const { byId, allIds } = objects
        return allIds.map(id => byId[id]).filter(object => object.partTypeId === partTypeId);
    }

    /*
    function getParentPartType( partTypeId ) {
        const { parent } = partTypes.byId[ partTypeId ]

        if ( parent ) {
            return partTypes.byId[ parent.id ]
        }

        return null
    }
    */

    /*
    function getObjectPartType( objectId ) {
        const partTypeId = objects.byId[ objectId ].partTypeId

        return partTypes.byId[ partTypeId ]
    }
    */

    function getAttachPoints( objectId ) {
        const object = objects.byId[ objectId ]

        if ( object.metadata ) {
            if ( object.metadata.attachPoints ) {
                return object.metadata.attachPoints
            }
        }

        return {}
    }

    function getAttachPointPosition( objectId, attachPointName ) {
        const attachPoints = getAttachPoints( objectId )

        return attachPoints[attachPointName] || POSITION_0_0_0;
    }

    function getPositionInsideParent( partType ) {
        const {
            id: parentPartTypeId,
            attachPoint: parentAttachPoint,
        } = partType.parent

        const parentObjectId = getSelectedObjectId( parentPartTypeId )

        return getAttachPointPosition( parentObjectId, parentAttachPoint )
    }

    function getPosition( partType ) {
        const object = getSelectedObject( partType.id )

        if ( !object ) {
            // should never happen!
            console.warn( `Object doesn't exist. This shouldn't normally happen` )
            return POSITION_0_0_0
        }

        if ( object.metadata ) {
            if ( object.metadata.position ) {
                return object.metadata.position
            }
        }

        return POSITION_0_0_0
    }

    /**
     * Recursively walks through part types until it reaches the root parent and
     * adds up all the attachpoint positions from the root to this partType
     * @param { string|number } partTypeId 
     */
    function computeGlobalPosition( partTypeId ) {
        const partType = getPartType( partTypeId )

        if ( !partType.parent ) {
            const pos = getPosition( partType )

            // return negated position to "undo" offset created when origin
            // point was moved to the center of the mesh
            return {
                x: -pos.x,
                y: -pos.y,
                z: -pos.z,
            }
        }

        const attachPointPosition = getPositionInsideParent( partType )

        const result = computeGlobalPosition( partType.parent.id ) // recursive step

        return {
            x: result.x + attachPointPosition.x,
            y: result.y + attachPointPosition.y,
            z: result.z + attachPointPosition.z,
        }
    }

    const getParentAttachPointPosition = partType => {
        if ( !partType.parent ) {
            return POSITION_0_0_0;
        }
        return getPositionInsideParent( partType )
    }

    const getChildPartTypeByAttachPoint = attachPoint => {
        return partTypesArray.find(partType => {
            return partType.parent && partType.parent.attachPoint === attachPoint;
        });
    }

    let downloadButtonMessage;
    if (userMustBuySelection) {
        if(isSelectionInCart) {
            downloadButtonMessage = 'Item already in cart';
        } else {
            downloadButtonMessage = `Add To Cart ($${price})`;
        }
    } else {
        downloadButtonMessage = `Download`;
    }

    const setSelected3dObject = (partTypeId, newObject) => {
        mainSceneManager.add(partTypeId, newObject);
        mainSceneManager.rescaleContainerToFitObjects( 4 )
        mainSceneManager.renderScene()
    };

    const setSelectedObjectId = (partTypeId, objectId) => {
        setSelectedParts(currentSelectedParts => ({
            ...currentSelectedParts,
            [partTypeId]: objectId
        }));
    };

    const handleObjectSelected = async (partTypeId, objectData) => {
        setIsLoading(true);

        try {

            const newObject = await get3DObject(objectData);
            setSelected3dObject(partTypeId, newObject);
            setSelectedObjectId(partTypeId, objectData.id);

        } catch ( err ) {
            const partType = partTypes.byId[partTypeId];
            console.error(
                `Something went wrong while loading object of type ${partType.name}:\n`
                + err
            );
        }

        setIsLoading(false);
    };

    const setObjectStatus = (objectId, statusCode) => {
        const statusReducer = (objects, objectId, status) => {
            const { byId, allIds } = objects;
            const modifiedObject = {
                ...byId[objectId],
                status
            };

            return {
                byId: {
                    ...byId,
                    [objectId]: modifiedObject
                },
                allIds
            };
        };

        setObjects(currentObjects => statusReducer(currentObjects, objectId, statusCode));
    };

    const addObject = objectToAdd => {
        const addReducer = ( objects, objectToAdd ) => {
            return {
                byId: {
                    ...objects.byId,
                    [ objectToAdd.id ]: objectToAdd
                },
                allIds: [
                    ...objects.allIds,
                    objectToAdd.id
                ]
            }
        }

        setObjects(currentObjects => addReducer(currentObjects, objectToAdd));
    }

    const handleDeleteObject = async (objectId) => {
        
        const oldStatus = objects.byId[objectId].status;

        setObjectStatus(objectId, OBJECT_STATUS.LOADING);

        try {
            
            await api.deletePart(objectId);
            setObjectStatus(objectId, OBJECT_STATUS.DELETED);
            
        } catch {
            setObjectStatus(objectId, oldStatus);
            console.error(`Failed to delete object with id ${objectId}`);
        }
    }

    const handleUpload = (partTypeId, filename, objectURL) => {
        const partType = partTypes.byId[partTypeId];

        const { name, extension } = getNameAndExtension(filename);

        if (!ACCEPTED_OBJECT_FILE_EXTENSIONS.includes(extension)) {
            console.error(`Unrecognized extension '${extension}'`);
            return;
        }

        setUploadedObjectData({
            partType,
            name,
            filename,
            extension,
            objectURL,
        });
    }

    const handleDownload = async () => {
        if(isSelectionInCart) {
            window.alert('item added to cart')
            return;
        }

        try {
            const customizedMeshData = await api.generateCustomizedMesh(selectedPartsIds);

            if(!userMustBuySelection) {
                if (customizedMeshData.status === 1) { // ready for download
                    const fullCustomizedMeshData = await api.getCustomizedMesh(customizedMeshData.id)
                    window.open(fullCustomizedMeshData.file_url);
                } else {
                    // TODO add popup component
        
                    const message = `You will receive an email when the mesh has finished processing.`
                    window.alert( message )
                }
            } else {
                const data = await api.addToCart(customizedMeshData.id);
                setCustomizedMeshesInCart(currenctCustomizedMeshesInCart => currenctCustomizedMeshesInCart.concat(customizedMeshData.id));
                setCustomizedMeshes(currentCustomizedMeshes => ({
                    ...currentCustomizedMeshes,
                    [customizedMeshData.id]: customizedMeshData
                }));

                window.customEventDispatcher.dispatchEvent('REFRESH_CART_AMOUNT');
                window.customEventDispatcher.dispatchEvent('ITEM_ADDED_TO_CART', data);
            }

        } catch (err) {
            console.error(err)

            if(err.response.data.error === "access_denied") {
                window.customEventDispatcher.dispatchEvent('SHOW_LOGIN');
            }
        }
    };

    const handleSaveChanges = async fields => {
        try {
            const updatedCustomizer = await api.patchCustomizer(fields);
            setName(updatedCustomizer['name']);
            setPrice(updatedCustomizer['price']);
            setDescription(updatedCustomizer['description']);
            setImageUrl(updatedCustomizer['image_url']);
            setIsPrivate(updatedCustomizer['is_private']);

        } catch (err) {
            console.error(err)
        }
    };

    const handleWizardCompleted = async (partType, { name, extension, objectURL, imageSrc, geometry, metadata }) => {
        setIsLoading(true);
        setUploadedObjectData(null);
        
        const partTypeId = partType.id
        
        const object = getObjectFromGeometry( geometry, metadata )
                
        const objectData = {
            name,
            files: {
                default: {
                    extension,
                    url: objectURL,
                }
            },
            img: imageSrc,
            extension: 'stl',
            metadata,
            partTypeId,
        }

        try {
            const id = await api.postPart(objectData)
    
            const objectToAdd = {
                ...objectData,
                id,
                status: OBJECT_STATUS.IN_SYNC
            }
    
            setSelected3dObject( partTypeId, object )
            setSelectedObjectId( partTypeId, id )
            addObject( objectToAdd )
        } catch {
            console.error(`Failed to upload object '${name}'`)
        }

        setIsLoading(false);
    }

    return (
        <div className = {styles.app}>

            <div className={styles.canvasContainer} ref={canvasContainerRef}>
            </div>

            <Header
                title = { customizerName }
                userName = {props.worldData['user_name']}
                userUrl = {props.worldData['user_url']}
            />

            <div className = {styles.editorPanelContainer}>
                <div className = {styles.editorPanel}>
                    <div className = {styles.partTypesContainer}>
                        <PartTypesView
                            partTypes = { partTypesArray }
                            selectedPartTypeId = { selectedPartTypeId }
                            onPartTypeSelected = { id => setSelectedPartTypeId(id) }
                        />
                    </div>
                    
                    <div className = {styles.selectorContainer}>
                        <Selector
                            data = { selectorData }
                            onObjectSelected = { handleObjectSelected }
                            onDelete = { handleDeleteObject }
                            onUpload = { handleUpload }
                            edit_mode = { props.edit_mode }
                        />
                    </div>
                </div>

            </div>

            <ButtonsContainer
                partTypes = { partTypesArray }
                onUpload = { handleUpload }
                onDownload = { handleDownload }
                downloadButtonMessage = {downloadButtonMessage}
                onShowSettings = {() => setShowSettings(true)}
                edit_mode = { props.edit_mode }
            />

            {showUploadWizard && (
                <UploadWizard
                    getGlobalPosition = { computeGlobalPosition }
                    getParentAttachPointPosition = {getParentAttachPointPosition}
                    getChildPartTypeByAttachPoint = {getChildPartTypeByAttachPoint}

                    data = { uploadedObjectData }
                    
                    showLoader = {() => setIsLoading(true)}
                    hideLoader = {() => setIsLoading(false)}
                    onWizardCanceled = {() => setUploadedObjectData(null)}
                    onWizardCompleted = {handleWizardCompleted}
                />
            )}

            {showSettings && (
                <SettingsPopup
                    className = {styles.settingsPopup}
                    
                    name = {customizerName}
                    price = {price}
                    description = {description}
                    isPrivate = {isPrivate}
                    imageUrl = {imageUrl}

                    onSave = {handleSaveChanges}
                    onCancel = {() => setShowSettings(false)}

                    customizer_pay_per_download_enabled = {props.customizer_pay_per_download_enabled}
                />
            )}

            <LoadingIndicator visible = {isLoading} />
        </div>
    );
}

export default App