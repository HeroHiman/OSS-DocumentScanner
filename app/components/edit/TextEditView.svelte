<script lang="ts">
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { getImagePipeline } from '@nativescript-community/ui-image';
    import { Application, EventData, File, Page, PanGestureEventData, Utils, View } from '@nativescript/core';
    import { AndroidActivityBackPressedEventData } from '@nativescript/core/application';
    import { confirm, inputType, prompt } from '@nativescript/core/ui/dialogs';
    import { closeModal } from '@shared/utils/svelte/ui';
    import { showError } from '@shared/utils/showError';
    import { cropDocumentFromFile } from 'plugin-nativeprocessor';
    import { onDestroy, onMount } from 'svelte';
    import CActionBar from '~/components/common/CActionBar.svelte';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { OCRDocument, OCRPage } from '~/models/OCRDocument';
    import { IMAGE_DECODE_HEIGHT, getImageExportSettings } from '~/utils/constants';
    import { getPageColorMatrix } from '~/utils/matrix';
    import { TextOverlayItem, burnTextToImageFile, calculateImageDisplayBounds } from '~/utils/textOverlay';
    import { hideLoading, onBackButton, showLoading, showSnack } from '~/utils/ui';
    import { colors, fonts, screenHeightDips, screenWidthDips, windowInset } from '~/variables';

    let { colorBackground, colorOnBackground, colorPrimary, colorOutline, colorSurfaceContainer } = $colors;
    $: ({ colorBackground, colorOnBackground, colorPrimary, colorOutline, colorSurfaceContainer } = $colors);

    export let item: OCRPage;
    export let document: OCRDocument;
    export let pageIndex: number;

    let page: NativeViewElementNode<Page>;
    const visualState = isEInk ? colorBackground : 'black';
    const textColor = isEInk ? colorOnBackground : 'white';

    // Check for existing text overlay on this page
    const existingOverlay: TextOverlayItem | undefined =
        item.extra?.textOverlays && Array.isArray(item.extra.textOverlays) && item.extra.textOverlays.length > 0
            ? item.extra.textOverlays[item.extra.textOverlays.length - 1]
            : undefined;
    const hasExistingOverlay = !!existingOverlay;

    // Text state (pre-populate from existing overlay if present)
    let overlayText = existingOverlay?.text || lc('tap_to_edit_text');
    let textX = existingOverlay?.screenX ?? 40;
    let textY = existingOverlay?.screenY ?? 100;
    let panStartX = 0;
    let panStartY = 0;
    let selectedColor = existingOverlay?.color || '#ff0000';
    let fontSize = existingOverlay?.fontSize ? Math.max(4, Math.min(72, existingOverlay.fontSize)) : 24;
    let hasBorder = existingOverlay?.hasBorder ?? false;
    let textRotation = existingOverlay?.textRotation ?? 0;
    let isLayoutInitialized = false;

    // Viewport dimensions
    let containerWidth = screenWidthDips;
    let containerHeight = screenHeightDips - 200;

    const availableColors = [
        { name: 'Red', hex: '#ff0000' },
        { name: 'Black', hex: '#000000' },
        { name: 'Blue', hex: '#0055ff' },
        { name: 'Green', hex: '#00aa00' },
        { name: 'Yellow', hex: '#ffcc00' },
        { name: 'White', hex: '#ffffff' },
        { name: 'Purple', hex: '#8800cc' },
        { name: 'Orange', hex: '#ff8800' }
    ];

    function onContainerLayout(event: EventData) {
        const view = event.object as View;
        if (view) {
            const measuredW = Utils.layout.toDeviceIndependentPixels(view.getMeasuredWidth());
            const measuredH = Utils.layout.toDeviceIndependentPixels(view.getMeasuredHeight());
            if (measuredW > 0 && measuredH > 0) {
                containerWidth = measuredW;
                containerHeight = measuredH;

                if (!isLayoutInitialized) {
                    isLayoutInitialized = true;
                    if (existingOverlay) {
                        if (existingOverlay.containerWidth && existingOverlay.containerHeight) {
                            const factorX = containerWidth / existingOverlay.containerWidth;
                            const factorY = containerHeight / existingOverlay.containerHeight;
                            textX = Math.round(existingOverlay.screenX * factorX);
                            textY = Math.round(existingOverlay.screenY * factorY);
                        } else {
                            textX = existingOverlay.screenX;
                            textY = existingOverlay.screenY;
                        }
                    } else {
                        const bounds = calculateImageDisplayBounds({
                            containerWidth,
                            containerHeight,
                            imageWidth: item.width || 1000,
                            imageHeight: item.height || 1000,
                            rotation: item.rotation || 0
                        });
                        textX = Math.round(bounds.offsetX + Math.min(40, bounds.displayedWidth * 0.1));
                        textY = Math.round(bounds.offsetY + Math.min(60, bounds.displayedHeight * 0.1));
                    }
                }
            }
        }
    }

    // Open a native dialog to edit the text safely
    async function editTextDialog() {
        try {
            const result = await prompt({
                title: lc('add_text'),
                message: lc('tap_to_edit_text'),
                defaultText: overlayText === lc('tap_to_edit_text') ? '' : overlayText,
                okButtonText: lc('apply'),
                cancelButtonText: lc('cancel')
            });

            if (result.result && result.text.trim() !== '') {
                overlayText = result.text;
            }
        } catch (error) {
            showError(error);
        }
    }

    function rotateText() {
        textRotation = (textRotation + 90) % 360;
    }

    async function onRotateCustom() {
        try {
            const result = await prompt({
                title: lc('rotate_text', 'Rotate Text'),
                message: lc('enter_rotation_angle', 'Enter rotation angle in degrees (0 - 360):'),
                defaultText: `${textRotation}`,
                okButtonText: lc('apply'),
                cancelButtonText: lc('cancel'),
                inputType: inputType.number
            });
            if (result.result && result.text.trim() !== '') {
                const angle = parseInt(result.text.trim(), 10);
                if (!isNaN(angle)) {
                    textRotation = ((angle % 360) + 360) % 360;
                }
            }
        } catch (error) {
            showError(error);
        }
    }

    let isPanning = false;
    function onPan(args: PanGestureEventData) {
        if (args.state === 1) {
            // Start pan
            if (!isPanning) {
                isPanning = true;
                panStartX = textX;
                panStartY = textY;
            }
        } else if (args.state === 2) {
            // Panning
            textX = Math.max(0, Math.min(containerWidth - 40, panStartX + args.deltaX));
            textY = Math.max(0, Math.min(containerHeight - 40, panStartY + args.deltaY));
        } else if (args.state === 3 || args.state === 0) {
            isPanning = false;
        }
    }

    function onGoBack() {
        closeModal(false);
    }

    async function onSave() {
        if (!overlayText || !overlayText.trim()) {
            closeModal(false);
            return;
        }
        if (overlayText === lc('tap_to_edit_text')) {
            await editTextDialog();
            if (!overlayText || !overlayText.trim() || overlayText === lc('tap_to_edit_text')) {
                return;
            }
        }
        try {
            await showLoading(lc('computing'));

            const file = File.fromPath(item.imagePath);
            const imageExportSettings = getImageExportSettings();
            const compressFormat = item.sourceImagePath.toLowerCase().endsWith('.png') ? 'png' : imageExportSettings.imageFormat;

            // Re-crop pristine base from sourceImagePath if we had an existing text overlay to prevent ghosting
            if (hasExistingOverlay && item.sourceImagePath) {
                await cropDocumentFromFile(item.sourceImagePath, [item.crop], {
                    transforms: item.transforms,
                    saveInFolder: file.parent.path,
                    fileName: file.name,
                    compressFormat,
                    compressQuality: imageExportSettings.imageQuality
                });
            }

            const overlayData: TextOverlayItem = {
                text: overlayText,
                screenX: textX,
                screenY: textY,
                containerWidth,
                containerHeight,
                fontSize,
                color: selectedColor,
                hasBorder,
                rotation: item.rotation ?? 0,
                textRotation
            };

            const result = await burnTextToImageFile({
                imagePath: item.imagePath,
                text: overlayText,
                screenX: textX,
                screenY: textY,
                containerWidth,
                containerHeight,
                fontSize,
                color: selectedColor,
                rotation: item.rotation ?? 0,
                textRotation,
                hasBorder
            });

            if (result.success) {
                const currentExtra = item.extra || {};
                await document.updatePage(
                    pageIndex,
                    {
                        size: result.size,
                        width: result.width,
                        height: result.height,
                        extra: {
                            ...currentExtra,
                            textOverlays: [overlayData]
                        }
                    },
                    true
                );
                showSnack({ message: lc('save') });
                closeModal(true);
            } else {
                throw new Error('Failed to burn text to image');
            }
        } catch (error) {
            showError(error);
        } finally {
            hideLoading();
        }
    }

    async function onRemoveText() {
        try {
            const confirmed = await confirm({
                title: lc('delete_text', 'Delete Text'),
                message: lc('confirm_delete_text', 'Are you sure you want to remove the text overlay from this page?'),
                okButtonText: lc('delete', 'Delete'),
                cancelButtonText: lc('cancel')
            });
            if (!confirmed) {
                return;
            }

            await showLoading(lc('computing'));
            const file = File.fromPath(item.imagePath);
            const imageExportSettings = getImageExportSettings();
            const compressFormat = item.sourceImagePath.toLowerCase().endsWith('.png') ? 'png' : imageExportSettings.imageFormat;

            const images = await cropDocumentFromFile(item.sourceImagePath, [item.crop], {
                transforms: item.transforms,
                saveInFolder: file.parent.path,
                fileName: file.name,
                compressFormat,
                compressQuality: imageExportSettings.imageQuality
            });
            const image = images[0];
            await getImagePipeline().evictFromCache(item.imagePath);

            const newExtra = { ...(item.extra || {}) };
            delete newExtra.textOverlays;

            const updatedFile = File.fromPath(item.imagePath);
            await document.updatePage(
                pageIndex,
                {
                    size: updatedFile.size,
                    width: image ? image.width : item.width,
                    height: image ? image.height : item.height,
                    extra: newExtra
                },
                true
            );
            showSnack({ message: lc('deleted', 'Deleted') });
            closeModal(true);
        } catch (error) {
            showError(error);
        } finally {
            hideLoading();
        }
    }

    const onAndroidBackButton = (data: AndroidActivityBackPressedEventData) =>
        onBackButton(page?.nativeView, () => {
            data.cancel = true;
            onGoBack();
        });

    onMount(() => {
        if (__ANDROID__) {
            Application.android.on(Application.android.activityBackPressedEvent, onAndroidBackButton);
        }
    });

    onDestroy(() => {
        if (__ANDROID__) {
            Application.android.off(Application.android.activityBackPressedEvent, onAndroidBackButton);
        }
    });
</script>

<page bind:this={page} id="modalTextEdit" actionBarHidden={true} statusBarStyle="dark">
    <gridlayout class="pageContent" backgroundColor={visualState} rows="auto,*,auto" android:paddingBottom={$windowInset.bottom}>
        <!-- Top Action Bar -->
        <CActionBar backgroundColor="transparent" buttonsDefaultVisualState={visualState} modalWindow={true} title={hasExistingOverlay ? lc('edit_text', 'Edit Text') : lc('add_text')}>
            <mdbutton class="actionBarButton" defaultVisualState={visualState} text="mdi-rotate-right" variant="text" on:tap={rotateText} on:longPress={onRotateCustom} />
            {#if hasExistingOverlay}
                <mdbutton class="actionBarButton" defaultVisualState={visualState} text="mdi-delete" variant="text" on:tap={onRemoveText} />
            {/if}
            <mdbutton class="actionBarButton" defaultVisualState={visualState} text="mdi-check" variant="text" on:tap={onSave} />
        </CActionBar>

        <!-- Canvas / Document Page Preview Layer -->
        <gridlayout row={1} on:layoutChanged={onContainerLayout} clipToBounds={true}>
            <image
                src={item.imagePath}
                imageRotation={item?.rotation ?? 0}
                colorMatrix={getPageColorMatrix(item)}
                decodeWidth={IMAGE_DECODE_HEIGHT}
                stretch="aspectFit"
                width="100%"
                height="100%"
            />

            <!-- Interactive Absolute Text Placement Layer -->
            <absolutelayout width="100%" height="100%" on:pan={onPan}>
                <label
                    text={overlayText}
                    left={textX}
                    top={textY}
                    rotate={textRotation}
                    on:pan={onPan}
                    on:tap={editTextDialog}
                    color={selectedColor}
                    fontSize={fontSize}
                    fontWeight="bold"
                    padding="4"
                    borderWidth={hasBorder ? 2 : 0}
                    borderColor={hasBorder ? selectedColor : 'transparent'}
                    backgroundColor="#00000022"
                    borderRadius={4}
                    textWrap={true}
                />
            </absolutelayout>
        </gridlayout>

        <!-- Bottom Controls Layer -->
        <stacklayout row={2} backgroundColor={colorSurfaceContainer} padding={12} borderTopColor={colorOutline} borderTopWidth={1}>
            <!-- Tap to edit text card/button -->
            <gridlayout columns="*,auto" margin="0 0 8 0" backgroundColor="#00000022" borderRadius={8} padding="10 12" on:tap={editTextDialog}>
                <label
                    col={0}
                    text={overlayText}
                    color={textColor}
                    fontSize={15}
                    verticalAlignment="center"
                    maxLines={2}
                    lineBreak="end"
                />
                <label
                    col={1}
                    text="mdi-pencil"
                    fontFamily={$fonts.mdi}
                    fontSize={20}
                    color={colorPrimary}
                    verticalAlignment="center"
                    marginLeft={8}
                />
            </gridlayout>

            <!-- Font Size Row -->
            <gridlayout columns="auto,*" verticalAlignment="center" margin="2 0 4 0">
                <label col={0} text={`Size: ${fontSize}px`} color={textColor} fontSize={14} verticalAlignment="center" marginRight={8} />
                <slider
                    col={1}
                    value={fontSize}
                    minValue={4}
                    maxValue={72}
                    on:valueChange={(e) => (fontSize = Math.max(4, Math.round(e.value)))}
                    verticalAlignment="center"
                />
            </gridlayout>

            <!-- Rotation & Border Controls Row -->
            <gridlayout columns="*,*" margin="2 0 6 0">
                <gridlayout
                    col={0}
                    columns="auto,*"
                    verticalAlignment="center"
                    padding="6 10"
                    margin="0 4 0 0"
                    borderRadius={8}
                    backgroundColor="#00000022"
                    on:tap={rotateText}
                    on:longPress={onRotateCustom}
                >
                    <label
                        col={0}
                        text="mdi-rotate-right"
                        fontFamily={$fonts.mdi}
                        fontSize={20}
                        color={colorPrimary}
                        verticalAlignment="center"
                    />
                    <label
                        col={1}
                        text={`${lc('rotate', 'Rotate')}: ${textRotation}°`}
                        fontSize={13}
                        color={textColor}
                        verticalAlignment="center"
                        marginLeft={6}
                    />
                </gridlayout>

                <gridlayout
                    col={1}
                    columns="auto,*"
                    verticalAlignment="center"
                    padding="6 10"
                    margin="0 0 0 4"
                    borderRadius={8}
                    backgroundColor={hasBorder ? '#00000022' : 'transparent'}
                    borderColor={hasBorder ? colorPrimary : colorOutline}
                    borderWidth={1}
                    on:tap={() => (hasBorder = !hasBorder)}
                >
                    <label
                        col={0}
                        text={hasBorder ? 'mdi-border-all' : 'mdi-border-none'}
                        fontFamily={$fonts.mdi}
                        fontSize={20}
                        color={hasBorder ? colorPrimary : textColor}
                        verticalAlignment="center"
                    />
                    <label
                        col={1}
                        text={lc('border', 'Border')}
                        fontSize={13}
                        fontWeight={hasBorder ? 'bold' : 'normal'}
                        color={hasBorder ? colorPrimary : textColor}
                        verticalAlignment="center"
                        marginLeft={6}
                    />
                </gridlayout>
            </gridlayout>

            <!-- Color Selection Chips -->
            <scrollview orientation="horizontal" height={40} margin="4 0 0 0">
                <stacklayout orientation="horizontal">
                    {#each availableColors as c}
                        <gridlayout
                            width={32}
                            height={32}
                            borderRadius={16}
                            backgroundColor={c.hex}
                            borderColor={selectedColor === c.hex ? colorPrimary : colorOutline}
                            borderWidth={selectedColor === c.hex ? 3 : 1}
                            margin="0 4 0 4"
                            on:tap={() => (selectedColor = c.hex)}
                        />
                    {/each}
                </stacklayout>
            </scrollview>
        </stacklayout>
    </gridlayout>
</page>
